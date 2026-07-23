import { ConsensusError, EXIT_CODES } from '../core/consensus-loop.js';
import type {
  ConsensusRecord,
  JsonRecord,
  SectionResult,
} from './refine-types.js';

function lastTwoPeerRevisionRecords(records: ConsensusRecord[]) {
  const peers = records.filter(
    (record) =>
      record?.agent !== 'user' &&
      record?.agent !== 'host-orchestrator' &&
      record?.verdict !== 'USER_INTERVENTION' &&
      record?.verdict !== 'HOST_DECISION' &&
      record?.record_type !== 'synthesis' &&
      record?.record_type !== 'synthesis-error',
  );
  return peers.slice(-2);
}

function latestSynthesisRecord(records: ConsensusRecord[]) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]?.record_type === 'synthesis') return records[index];
  }
  return null;
}

function revisionText(record: ConsensusRecord | null | undefined) {
  if (typeof record?.proposed_artifact === 'string')
    return record.proposed_artifact;
  if (typeof record?.synthesized_artifact === 'string')
    return record.synthesized_artifact;
  return '';
}

/**
 * Build the escalation_required event payload for a section (p04-t04). Resolves
 * the FULL divergent text from the section's records (both latest peer revisions,
 * plus synthesis text + unresolved disagreements in synthesized mode) and the
 * resume vector. This is the only content-bearing routine event (NFR5 boundary).
 */
export function buildEscalationEvent(
  section: SectionResult,
  { artifactPath }: { artifactPath?: string | null } = {},
) {
  const escalation = section?.status?.escalation;
  if (!escalation) return null;

  const records = section.records ?? [];
  const [left, right] = lastTwoPeerRevisionRecords(records);
  const synthesis = latestSynthesisRecord(records);

  const divergent: JsonRecord = {
    a: {
      agent: left?.agent ?? escalation.divergent?.a?.agent ?? null,
      text: revisionText(left),
    },
    b: {
      agent: right?.agent ?? escalation.divergent?.b?.agent ?? null,
      text: revisionText(right),
    },
  };
  if (synthesis || escalation.divergent?.synthesis) {
    divergent.synthesis = {
      text: revisionText(synthesis),
      unresolved_disagreements: Array.isArray(
        synthesis?.unresolved_disagreements,
      )
        ? synthesis.unresolved_disagreements
        : (escalation.divergent?.synthesis?.unresolved_disagreements ?? []),
    };
  }

  const flag =
    escalation.decide_via === 'user' ? '--user-direction' : '--host-direction';

  const event: JsonRecord = {
    section_id: section.id,
    section_name: section.name,
    trigger: escalation.trigger,
    decide_via: escalation.decide_via,
    decision_kinds: escalation.decision_kinds ?? [],
    divergent,
    resume: { artifact_path: artifactPath ?? null, flag },
  };
  if (escalation.promoted_from) {
    event.promoted_from = escalation.promoted_from;
  }
  return event;
}

export function escalatedSections(sections: SectionResult[]) {
  return sections.filter((section) => section.status?.status === 'escalation');
}

function escalationRoutingError(message: string, details: JsonRecord = {}) {
  return new ConsensusError(message, {
    code: 'ESCALATION_ROUTING',
    exitCode: EXIT_CODES.CONFIG,
    details,
  });
}

/**
 * Fail-closed routing guard for --host-direction (p04-t05). A host direction is
 * only valid against a pending escalation whose decide_via is 'host'. It is
 * rejected when no escalation is pending or when the pending escalation routes
 * to the user (ESCALATION_ROUTING).
 */
export function assertHostDirectionRoutable(resumeSection: SectionResult) {
  const escalation = resumeSection?.status?.escalation;
  if (resumeSection?.status?.status !== 'escalation' || !escalation) {
    throw escalationRoutingError(
      '--host-direction supplied but no escalation is pending for resume',
      {
        section_status: resumeSection?.status?.status ?? null,
      },
    );
  }
  if (escalation.decide_via !== 'host') {
    throw escalationRoutingError(
      `--host-direction rejected: pending escalation routes to ${escalation.decide_via}`,
      { decide_via: escalation.decide_via, trigger: escalation.trigger },
    );
  }
  return escalation;
}

export function failingSections(sections: SectionResult[]) {
  return sections
    .filter((section) => {
      const sectionStatus = section.status?.status;
      return sectionStatus === 'error' || sectionStatus === 'impasse';
    })
    .map((section) => ({
      id: section.id,
      name: section.name,
      original_index: section.original_index,
      status: section.status?.status ?? 'unknown',
      termination_reason: section.status?.termination_reason ?? null,
    }));
}
