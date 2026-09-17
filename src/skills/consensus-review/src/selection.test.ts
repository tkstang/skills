import { describe, expect, it } from 'vitest';

import type { ProviderInventoryEntry } from '../../../plugins/consensus/provider-cli/types.js';
import type { CapturedReviewScope } from './scope.js';
import {
  buildReviewPrompt,
  resolveReviewer,
  REVIEW_PROMPT_MAX_BYTES,
  REVIEW_REQUEST_MAX_BYTES,
} from './selection.js';

describe('reviewer selection', () => {
  it('preflights automatic preferences in exact order, skips ineligible entries, and forwards saved options', async () => {
    const calls: string[] = [];
    const result = await resolveReviewer(
      {
        cwd: '/repo',
        host: 'cursor',
        invocationReviewers: [
          { provider: 'cursor' },
          { provider: 'claude' },
          { provider: 'codex', model: 'gpt-review', effort: 'high' },
        ],
      },
      {
        async preflight(provider) {
          calls.push(provider);
          return ready(
            provider,
            provider === 'claude' ? 'auth_required' : 'ready',
          );
        },
      },
    );

    expect(calls).toEqual(['claude', 'codex']);
    expect(result).toMatchObject({
      source: 'invocation',
      pinned: false,
      reviewer: {
        provider: 'codex',
        model: 'gpt-review',
        effort: 'high',
      },
      skipped: [
        {
          provider: 'cursor',
          reason: 'provider_has_no_supported_read_only_review_policy',
        },
        { provider: 'claude', reason: 'provider_auth_required' },
      ],
    });
  });

  it('excludes the host automatically and requires pinned consent for same-provider review', async () => {
    const preflight = async (provider: string) => ready(provider, 'ready');
    await expect(
      resolveReviewer({ cwd: '/repo', host: 'claude' }, { preflight }),
    ).resolves.toMatchObject({
      reviewer: { provider: 'codex' },
      skipped: [{ provider: 'claude', reason: 'host_provider_excluded' }],
    });
    await expect(
      resolveReviewer(
        { cwd: '/repo', host: 'claude', reviewer: 'claude' },
        { preflight },
      ),
    ).rejects.toThrow('same_provider_consent_required');
    await expect(
      resolveReviewer(
        {
          cwd: '/repo',
          host: 'claude',
          reviewer: 'claude:opus',
          effort: 'high',
          allowSameProvider: true,
        },
        { preflight },
      ),
    ).resolves.toMatchObject({
      pinned: true,
      reviewer: { provider: 'claude', model: 'opus', effort: 'high' },
      allowSameProvider: true,
    });
  });

  it('does not fall back after a pinned candidate fails preflight', async () => {
    const calls: string[] = [];
    await expect(
      resolveReviewer(
        { cwd: '/repo', host: 'codex', reviewer: 'claude' },
        {
          async preflight(provider) {
            calls.push(provider);
            return ready(provider, 'missing');
          },
        },
      ),
    ).rejects.toThrow('provider_missing');
    expect(calls).toEqual(['claude']);
  });

  it('skips unsupported configured options before dispatch in automatic mode', async () => {
    const result = await resolveReviewer(
      {
        cwd: '/repo',
        host: 'cursor',
        invocationReviewers: [
          { provider: 'claude', model: 'unsupported-here' },
          { provider: 'codex' },
        ],
      },
      {
        async preflight(provider) {
          const entry = ready(provider, 'ready');
          if (provider === 'claude') entry.capabilities.options.model = false;
          return entry;
        },
      },
    );

    expect(result.reviewer).toEqual({ provider: 'codex' });
    expect(result.skipped).toEqual([
      {
        provider: 'claude',
        reason: 'provider_model_option_unsupported: claude',
      },
    ]);
  });

  it.each([
    [{ cwd: '/repo', host: 'unknown' }, 'unknown_host'],
    [
      { cwd: '/repo', host: 'codex', model: 'gpt-review' },
      'reviewer_required_for_model_or_effort',
    ],
    [
      { cwd: '/repo', host: 'codex', effort: 'high' },
      'reviewer_required_for_model_or_effort',
    ],
    [
      { cwd: '/repo', host: 'codex', allowSameProvider: true },
      'pinned_reviewer_required_for_same_provider_consent',
    ],
    [
      {
        cwd: '/repo',
        host: 'codex',
        reviewer: 'claude:opus',
        model: 'sonnet',
      },
      'reviewer_model_conflict',
    ],
  ] as const)(
    'rejects invalid selection input before any preflight: %#',
    async (input, message) => {
      let calls = 0;
      await expect(
        resolveReviewer(input, {
          async preflight() {
            calls += 1;
            return ready('claude', 'ready');
          },
        }),
      ).rejects.toThrow(message);
      expect(calls).toBe(0);
    },
  );
});

describe('bounded review prompts', () => {
  it('separates request, host summary, captured evidence, and instructions', () => {
    const prompt = buildReviewPrompt({
      request: 'Check <this> carefully.',
      hostSummary: 'Host says > focus on behavior.',
      scope: capturedScope(),
      evidencePath: '/state/run/evidence.json',
    });

    expect(prompt).toContain(
      '<user_request_data>\nCheck &lt;this&gt; carefully.',
    );
    expect(prompt).toContain(
      '<host_summary_data>\nHost says &gt; focus on behavior.',
    );
    expect(prompt).toContain('<captured_evidence_data>');
    expect(prompt).toContain('author_identity=unknown');
    expect(Buffer.byteLength(prompt)).toBeLessThanOrEqual(
      REVIEW_PROMPT_MAX_BYTES,
    );
  });

  it('references a captured request file when the request cannot fit inline', () => {
    const request = 'x'.repeat(40 * 1024);
    const prompt = buildReviewPrompt({
      request,
      hostSummary: 'bounded summary',
      scope: capturedScope(),
      evidencePath: '/state/run/evidence.json',
      requestPath: '/state/run/request.txt',
    });

    expect(prompt).toContain('request_path=/state/run/request.txt');
    expect(prompt).toContain(`request_bytes=${Buffer.byteLength(request)}`);
    expect(prompt).not.toContain(request);
  });

  it('rejects request and prompt bounds without truncation', () => {
    expect(() =>
      buildReviewPrompt({
        request: 'x'.repeat(REVIEW_REQUEST_MAX_BYTES + 1),
        hostSummary: '',
        scope: capturedScope(),
        evidencePath: '/state/run/evidence.json',
      }),
    ).toThrow('review_request_too_large');
    expect(() =>
      buildReviewPrompt({
        request: 'x'.repeat(40 * 1024),
        hostSummary: '',
        scope: capturedScope(),
        evidencePath: '/state/run/evidence.json',
      }),
    ).toThrow('review_request_file_required');
    expect(() =>
      buildReviewPrompt({
        request: 'review',
        hostSummary: 'x'.repeat(REVIEW_PROMPT_MAX_BYTES),
        scope: capturedScope(),
        evidencePath: '/state/run/evidence.json',
      }),
    ).toThrow('review_prompt_too_large');
  });
});

function ready(
  provider: string,
  status: ProviderInventoryEntry['status'],
): ProviderInventoryEntry {
  return {
    id: provider,
    status,
    capabilities: {
      schema_strategies:
        provider === 'codex'
          ? ['constrained_native', 'prompt_only']
          : ['provider_validated', 'prompt_only'],
      output_modes:
        provider === 'codex' ? ['last_message_file'] : ['stdout_json'],
      options: {
        model: true,
        effort: provider === 'codex' ? 'reasoning_effort' : 'effort',
        runtime_policy: {
          permission_modes: ['read-only'],
          env_allowlist: false,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: false,
      supports_host_native_dispatch: false,
    },
  };
}

function capturedScope(): CapturedReviewScope {
  return {
    token: 'scope-token',
    request: { kind: 'files', paths: ['src/example.ts'] },
    canonicalWorktree: '/repo',
    head: 'abc123',
    selectedPaths: ['src/example.ts'],
    externalDocuments: [],
    evidenceBytes: 8,
    versions: [
      {
        source: 'live',
        path: 'src/example.ts',
        kind: 'file',
        mode: 0o644,
        bytes: 8,
        sha256: 'hash',
        text: 'content\n',
      },
    ],
  };
}
