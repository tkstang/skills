import { createHash } from 'node:crypto';

import type {
  CursorFrameIssue,
  CursorTranscriptFrame,
  CursorTranscriptScan,
} from './cursor-frames.js';
import {
  isAutomaticControlAcknowledgement,
  isNoOpText,
  parseAutomaticControlEnvelope,
} from './runtimes.js';
import type { CursorIdentityEvidence, JsonObject } from './runtimes.js';

export type CursorLifecycleState =
  | 'pending'
  | 'success'
  | 'aborted'
  | 'error'
  | 'cancelled'
  | 'unknown';

export type CursorContentClassification =
  | 'substantive'
  | 'empty'
  | 'no-op'
  | 'automatic-control'
  | 'runtime-diagnostic'
  | 'unsupported';

export interface CursorContentRecord {
  entryKey: string;
  turnId: string;
  sourceFrameIndex: number;
  blockIndex: number;
  role: 'user' | 'assistant';
  text: string;
  classification: CursorContentClassification;
}

export interface CursorAssistantContentRecord extends CursorContentRecord {
  role: 'assistant';
}

export interface CursorTurnAnalysis {
  turnId: string;
  fromFrameIndex: number;
  observedThroughFrame: number;
  assistantRecords: CursorAssistantContentRecord[];
  humanRecordIndexes: number[];
  toolRecordIndexes: number[];
  lifecycle: CursorLifecycleState;
  terminalFrameIndex: number | null;
  finalSubstantiveEntryKey: string | null;
}

export interface CursorTranscriptAnalysis {
  turns: CursorTurnAnalysis[];
  metadataFrameIndexes: number[];
  blockingFrame: CursorFrameIssue | null;
}

export interface CursorTurnAccumulator {
  onFrame(frame: CursorTranscriptFrame): void;
  finish(scan: CursorTranscriptScan): CursorTranscriptAnalysis;
}

interface ContentBlock {
  blockIndex: number;
  kind: 'text' | 'tool' | 'runtime-diagnostic' | 'unsupported';
  text: string;
}

interface MutableCursorTurn {
  turnId: string;
  fromFrameIndex: number;
  observedThroughFrame: number;
  assistantRecords: CursorAssistantContentRecord[];
  humanRecordIndexes: number[];
  toolRecordIndexes: number[];
  hasAutomaticControlInput: boolean;
  hasHumanInput: boolean;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function identityScope(identity: CursorIdentityEvidence): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        identity.runtime,
        identity.projectCwd,
        identity.sessionId,
        identity.canonicalTranscriptPath,
      ]),
    )
    .digest('hex');
}

function validateIdentity(identity: CursorIdentityEvidence): void {
  if (identity.runtime !== 'cursor') {
    throw new TypeError('runtime must be cursor');
  }
  for (const field of [
    'projectCwd',
    'sessionId',
    'canonicalTranscriptPath',
  ] as const) {
    if (!identity[field]?.trim()) {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  }
}

function contentBlocks(record: JsonObject): ContentBlock[] {
  const message = isJsonObject(record.message) ? record.message : record;
  const content = message.content;

  if (typeof content === 'string') {
    return [{ blockIndex: 0, kind: 'text', text: content }];
  }
  if (!Array.isArray(content)) {
    return [{ blockIndex: 0, kind: 'unsupported', text: '' }];
  }

  return content.map((block, blockIndex): ContentBlock => {
    if (!isJsonObject(block)) {
      return { blockIndex, kind: 'unsupported', text: '' };
    }

    const type = stringValue(block.type);
    if (type === 'tool_use') {
      return { blockIndex, kind: 'tool', text: '' };
    }

    const text = stringValue(block.text) ?? stringValue(block.content) ?? '';
    if (type === 'runtime_diagnostic' || type === 'diagnostic') {
      return { blockIndex, kind: 'runtime-diagnostic', text };
    }
    if (type === 'text') {
      return { blockIndex, kind: 'text', text };
    }
    return { blockIndex, kind: 'unsupported', text };
  });
}

function lifecycleState(status: unknown): CursorLifecycleState {
  return status === 'success' ||
    status === 'aborted' ||
    status === 'error' ||
    status === 'cancelled'
    ? status
    : 'unknown';
}

function classifyAssistantText(
  block: ContentBlock,
  hasAutomaticControlInput: boolean,
  hasHumanInput: boolean,
): CursorContentClassification {
  if (block.kind === 'runtime-diagnostic') return 'runtime-diagnostic';
  if (block.kind === 'unsupported') return 'unsupported';
  if (block.text.trim().length === 0) return 'empty';
  if (isNoOpText(block.text)) return 'no-op';
  if (
    parseAutomaticControlEnvelope(block.text) !== null ||
    (hasAutomaticControlInput &&
      !hasHumanInput &&
      isAutomaticControlAcknowledgement(block.text))
  ) {
    return 'automatic-control';
  }
  return 'substantive';
}

export function createCursorTurnAccumulator(
  identity: CursorIdentityEvidence,
  fromFrameIndex: number,
): CursorTurnAccumulator {
  validateIdentity(identity);
  if (!Number.isSafeInteger(fromFrameIndex) || fromFrameIndex < 0) {
    throw new TypeError('fromFrameIndex must be a non-negative safe integer');
  }

  const scope = identityScope(identity);
  const turns: CursorTurnAnalysis[] = [];
  const metadataFrameIndexes: number[] = [];
  let nextTurnStart = fromFrameIndex;
  let current: MutableCursorTurn | null = null;
  let lastFrameIndex = -1;
  let blocked = false;
  let finished = false;

  const ensureTurn = (observedFrameIndex: number): MutableCursorTurn => {
    if (current !== null) return current;
    const turnId = `cursor:${scope}:turn:${nextTurnStart}`;
    current = {
      turnId,
      fromFrameIndex: nextTurnStart,
      observedThroughFrame: observedFrameIndex,
      assistantRecords: [],
      humanRecordIndexes: [],
      toolRecordIndexes: [],
      hasAutomaticControlInput: false,
      hasHumanInput: false,
    };
    return current;
  };

  const finishCurrentTurn = (
    lifecycle: CursorLifecycleState,
    terminalFrameIndex: number | null,
  ): void => {
    if (current === null) return;
    const finalSubstantive =
      lifecycle === 'success'
        ? current.assistantRecords.findLast(
            (record) => record.classification === 'substantive',
          )
        : undefined;
    turns.push({
      turnId: current.turnId,
      fromFrameIndex: current.fromFrameIndex,
      observedThroughFrame: current.observedThroughFrame,
      assistantRecords: current.assistantRecords,
      humanRecordIndexes: current.humanRecordIndexes,
      toolRecordIndexes: current.toolRecordIndexes,
      lifecycle,
      terminalFrameIndex,
      finalSubstantiveEntryKey: finalSubstantive?.entryKey ?? null,
    });
    current = null;
  };

  return {
    onFrame(frame): void {
      if (finished) {
        throw new Error('cannot add frames after analysis is finished');
      }
      if (
        !Number.isSafeInteger(frame.frameIndex) ||
        frame.frameIndex <= lastFrameIndex
      ) {
        throw new TypeError(
          'Cursor frames must have strictly increasing non-negative indexes',
        );
      }
      lastFrameIndex = frame.frameIndex;

      if (frame.parseState === 'malformed' || frame.parseState === 'partial') {
        blocked = true;
        return;
      }
      if (blocked || frame.frameIndex < fromFrameIndex) return;

      if (frame.parseState === 'blank' || frame.record === null) {
        if (current !== null) {
          current.observedThroughFrame = frame.frameIndex;
        }
        return;
      }

      const record = frame.record;
      if (record.type === 'turn_ended') {
        const turn = ensureTurn(frame.frameIndex);
        turn.observedThroughFrame = frame.frameIndex;
        const lifecycle = lifecycleState(record.status);
        finishCurrentTurn(lifecycle, frame.frameIndex);
        nextTurnStart = frame.frameIndex + 1;
        return;
      }

      const role = stringValue(record.role);
      if (role !== 'user' && role !== 'assistant') {
        metadataFrameIndexes.push(frame.frameIndex);
        if (current !== null) {
          current.observedThroughFrame = frame.frameIndex;
        }
        return;
      }

      const turn = ensureTurn(frame.frameIndex);
      turn.observedThroughFrame = frame.frameIndex;
      const blocks = contentBlocks(record);
      if (blocks.some((block) => block.kind === 'tool')) {
        turn.toolRecordIndexes.push(frame.frameIndex);
      }

      if (role === 'user') {
        let automaticControl = false;
        let humanInput = false;
        for (const block of blocks) {
          if (block.kind !== 'text' || block.text.trim().length === 0) {
            continue;
          }
          if (parseAutomaticControlEnvelope(block.text) !== null) {
            automaticControl = true;
          } else {
            humanInput = true;
          }
        }
        if (automaticControl) {
          turn.hasAutomaticControlInput = true;
        }
        if (humanInput) {
          turn.hasHumanInput = true;
          turn.humanRecordIndexes.push(frame.frameIndex);
        }
        return;
      }

      for (const block of blocks) {
        if (block.kind === 'tool') continue;
        const classification = classifyAssistantText(
          block,
          turn.hasAutomaticControlInput,
          turn.hasHumanInput,
        );
        turn.assistantRecords.push({
          entryKey: `${turn.turnId}:frame:${frame.frameIndex}:block:${block.blockIndex}`,
          turnId: turn.turnId,
          sourceFrameIndex: frame.frameIndex,
          blockIndex: block.blockIndex,
          role: 'assistant',
          text: block.text,
          classification,
        });
      }
    },

    finish(scan): CursorTranscriptAnalysis {
      if (finished) {
        throw new Error('Cursor analysis can only be finished once');
      }
      finished = true;

      if (
        current !== null &&
        scan.safeThroughFrame !== null &&
        scan.safeThroughFrame >= current.fromFrameIndex
      ) {
        current.observedThroughFrame = Math.max(
          current.observedThroughFrame,
          scan.safeThroughFrame,
        );
        finishCurrentTurn('pending', null);
      }

      return {
        turns,
        metadataFrameIndexes,
        blockingFrame: scan.blockingFrame,
      };
    },
  };
}
