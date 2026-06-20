import { readFile } from 'node:fs/promises';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';

const {
  LOOP_SCHEMA_VERSION,
  SYNTHESIS_CAPS,
  VERDICT_CAPS,
  validateSynthesisCaps,
  validateSynthesisShape,
  validateVerdictCaps,
  validateVerdictShape,
  normalizeVerdict,
} = consensusLoop;

const schemaPath = new URL(
  '../../../plugins/consensus/skills/refine/schemas/verdict-alternating.schema.json',
  import.meta.url,
);

const parallelSchemaPath = new URL(
  '../../../plugins/consensus/skills/refine/schemas/verdict-parallel.schema.json',
  import.meta.url,
);

const synthesisSchemaPath = new URL(
  '../../../plugins/consensus/skills/refine/schemas/synthesis.schema.json',
  import.meta.url,
);

function validSynthesis(overrides: Record<string, any> = {}) {
  return {
    schema_version: 'v1',
    synthesized_artifact: 'Merged section.\n',
    synthesis_reasoning:
      'Took the stronger framing from peer A and the example from peer B.',
    unresolved_disagreements: [],
    ...overrides,
  };
}

function validVerdict(overrides: Record<string, any> = {}) {
  return {
    schema_version: 'v1',
    verdict: 'ACCEPT',
    reasoning: 'Looks good.',
    ...overrides,
  };
}

function parallelCritique(overrides: Record<string, any> = {}) {
  return {
    own_previous: 'My prior draft was thin.',
    peer_previous: 'Peer prior draft over-claimed.',
    ...overrides,
  };
}

function parallelVerdict(overrides: Record<string, any> = {}) {
  return {
    schema_version: 'v1',
    verdict: 'REVISE',
    reasoning: 'Tightened the argument.',
    critique: parallelCritique(),
    proposed_artifact: 'Revised section.\n',
    ...overrides,
  };
}

it('loop and alternating schema both speak schema v1', async () => {
  expect(LOOP_SCHEMA_VERSION).toBe('v1');

  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  expect(schema.properties.schema_version.const).toBe('v1');
});

it('verdict schema declares alternating branches without maxLength caps', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const serialized = JSON.stringify(schema);

  expect(schema.$id).toBe(
    'consensus-plugin/v1/verdict-alternating.schema.json',
  );
  expect(schema.required).toEqual([
    'schema_version',
    'verdict',
    'reasoning',
    'proposed_artifact',
    'concerns',
  ]);
  // The schema is the provider-side (prompt+parse) shape only. It must stay
  // compatible with OpenAI/codex structured output, which forbids `oneOf`/`not`;
  // the per-verdict conditional requirements (proposed_artifact required for
  // REVISE, forbidden for ACCEPT/IMPASSE) are enforced by validateVerdictShape's
  // branch tables, not by the schema. See tests below.
  expect('oneOf' in schema).toBe(false);
  expect(serialized.includes('"not"')).toBe(false);
  expect(serialized.includes('maxLength')).toBe(false);

  expect(schema.properties.verdict.enum).toEqual([
    'ACCEPT',
    'REVISE',
    'IMPASSE',
  ]);
});

it('normalizeVerdict strips empty disallowed fields from strict structured output', () => {
  // OpenAI/codex strict output emits every property; a non-REVISE verdict arrives
  // carrying empty proposed_artifact/concerns. Those empties normalize away and
  // the verdict validates cleanly.
  const strictAccept = {
    schema_version: 'v1',
    verdict: 'ACCEPT',
    reasoning: 'good as-is',
    proposed_artifact: '',
    concerns: [],
  };
  const normalized = normalizeVerdict(strictAccept, 'alternating');
  expect('proposed_artifact' in normalized).toBe(false);
  expect(validateVerdictShape(normalized, { mode: 'alternating' })).toEqual({
    ok: true,
    errors: [],
  });

  // Parallel CONVERGED with empty proposed_artifact + a real critique normalizes/validates.
  const strictConverged = {
    schema_version: 'v1',
    verdict: 'CONVERGED',
    reasoning: 'aligned',
    critique: { own_previous: 'fine', peer_previous: 'fine' },
    proposed_artifact: '',
  };
  const normConv = normalizeVerdict(strictConverged, 'parallel_revision');
  expect('proposed_artifact' in normConv).toBe(false);
  expect(validateVerdictShape(normConv, { mode: 'parallel_revision' })).toEqual(
    { ok: true, errors: [] },
  );
});

it('normalizeVerdict keeps required fields and drops unused branch fields', () => {
  // A REVISE keeps its required proposed_artifact.
  const revise = {
    schema_version: 'v1',
    verdict: 'REVISE',
    reasoning: 'tighten',
    proposed_artifact: 'New text.',
  };
  expect(normalizeVerdict(revise, 'alternating')).toEqual(revise);
  // An ACCEPT carrying a non-empty proposed_artifact (codex echoes content under
  // strict output): the loop never applies it on ACCEPT, so it is dropped and the
  // stated verdict (ACCEPT) is honored.
  const acceptWithContent = {
    schema_version: 'v1',
    verdict: 'ACCEPT',
    reasoning: 'ok',
    proposed_artifact: 'echoed current text',
  };
  const norm = normalizeVerdict(acceptWithContent, 'alternating');
  expect('proposed_artifact' in norm).toBe(false);
  expect(validateVerdictShape(norm, { mode: 'alternating' })).toEqual({
    ok: true,
    errors: [],
  });
});

it('validateVerdictShape accepts ACCEPT, REVISE, and IMPASSE verdicts', () => {
  expect(validateVerdictShape(validVerdict())).toEqual({
    ok: true,
    errors: [],
  });
  expect(
    validateVerdictShape(
      validVerdict({
        verdict: 'REVISE',
        proposed_artifact: 'Updated section.',
      }),
    ),
  ).toEqual({ ok: true, errors: [] });
  expect(
    validateVerdictShape(
      validVerdict({ verdict: 'IMPASSE', concerns: ['conflict remains'] }),
    ),
  ).toEqual({ ok: true, errors: [] });
  expect(validateVerdictShape(validVerdict({ verdict: 'IMPASSE' }))).toEqual({
    ok: true,
    errors: [],
  });
});

it('validateVerdictShape enforces schema version, branch requirements, and additional properties', () => {
  expect(
    validateVerdictShape(validVerdict({ schema_version: 'v0' })).errors.join(
      '\n',
    ),
  ).toMatch(/schema_version/);
  expect(
    validateVerdictShape(validVerdict({ verdict: 'REVISE' })).errors.join('\n'),
  ).toMatch(/proposed_artifact/);
  expect(
    validateVerdictShape({
      schema_version: 'v1',
      decision: 'ACCEPT',
      reasoning: 'old',
    }).errors.join('\n'),
  ).toMatch(/verdict/);
  expect(
    validateVerdictShape(validVerdict({ extra: true })).errors.join('\n'),
  ).toMatch(/additional property: extra/);
});

it('parallel verdict schema declares the parallel vocabulary and critique fields', async () => {
  const schema = JSON.parse(await readFile(parallelSchemaPath, 'utf8'));

  expect(schema.$id).toBe('consensus-plugin/v1/verdict-parallel.schema.json');
  expect(schema.properties.schema_version.const).toBe('v1');
  expect(schema.properties.verdict.enum).toEqual([
    'REVISE',
    'ACCEPT_PEER',
    'CONVERGED',
    'IMPASSE',
  ]);
  expect(schema.required).toEqual([
    'schema_version',
    'verdict',
    'reasoning',
    'critique',
    'proposed_artifact',
    'concerns',
  ]);
  expect(schema.properties.critique).toBeTruthy();
  expect(schema.properties.critique.required).toEqual([
    'own_previous',
    'peer_previous',
  ]);
  expect(JSON.stringify(schema).includes('maxLength')).toBe(false);
});

it('validateVerdictShape accepts the parallel vocabulary in parallel mode', () => {
  expect(
    validateVerdictShape(parallelVerdict(), { mode: 'parallel_revision' }),
  ).toEqual({ ok: true, errors: [] });
  expect(
    validateVerdictShape(
      parallelVerdict({
        verdict: 'ACCEPT_PEER',
        proposed_artifact: 'Adopted peer text.\n',
      }),
      { mode: 'parallel_synthesized' },
    ),
  ).toEqual({ ok: true, errors: [] });
  expect(
    validateVerdictShape(
      {
        schema_version: 'v1',
        verdict: 'CONVERGED',
        reasoning: 'We agree.',
        critique: parallelCritique(),
      },
      { mode: 'parallel_revision' },
    ),
  ).toEqual({ ok: true, errors: [] });
  expect(
    validateVerdictShape(
      {
        schema_version: 'v1',
        verdict: 'IMPASSE',
        reasoning: 'Cannot agree.',
        critique: parallelCritique(),
      },
      { mode: 'parallel_revision' },
    ),
  ).toEqual({ ok: true, errors: [] });
});

it('validateVerdictShape enforces critique and artifact requirements per parallel branch', () => {
  // critique is OPTIONAL (round 1 has no prior revision to critique): a REVISE
  // that omits the critique key is valid as long as it carries proposed_artifact.
  expect(
    validateVerdictShape(
      {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: 'Round 1 revision.',
        proposed_artifact: 'Tightened.\n',
      },
      { mode: 'parallel_revision' },
    ),
  ).toEqual({ ok: true, errors: [] });
  // When critique IS present, its structure is still validated.
  expect(
    validateVerdictShape(
      parallelVerdict({ critique: { own_previous: 'only own' } }),
      { mode: 'parallel_revision' },
    ).errors.join('\n'),
  ).toMatch(/peer_previous/);
  expect(
    validateVerdictShape(parallelVerdict({ proposed_artifact: undefined }), {
      mode: 'parallel_revision',
    }).errors.join('\n'),
  ).toMatch(/proposed_artifact/);
  expect(
    validateVerdictShape(
      {
        schema_version: 'v1',
        verdict: 'ACCEPT_PEER',
        reasoning: 'Adopt.',
        critique: parallelCritique(),
      },
      { mode: 'parallel_revision' },
    ).errors.join('\n'),
  ).toMatch(/proposed_artifact/);
  // CONVERGED without critique is valid (critique optional).
  expect(
    validateVerdictShape(
      { schema_version: 'v1', verdict: 'CONVERGED', reasoning: 'Agree.' },
      { mode: 'parallel_revision' },
    ),
  ).toEqual({ ok: true, errors: [] });
});

it('validateVerdictShape rejects cross-mode vocabularies', () => {
  // Alternating vocabulary is invalid in parallel mode.
  expect(
    validateVerdictShape(validVerdict({ verdict: 'ACCEPT' }), {
      mode: 'parallel_revision',
    }).errors.join('\n'),
  ).toMatch(/verdict/);
  // Parallel vocabulary is invalid in alternating mode (default and explicit).
  expect(
    validateVerdictShape(
      parallelVerdict({ verdict: 'ACCEPT_PEER' }),
    ).errors.join('\n'),
  ).toMatch(/verdict/);
  expect(
    validateVerdictShape(parallelVerdict({ verdict: 'CONVERGED' }), {
      mode: 'alternating',
    }).errors.join('\n'),
  ).toMatch(/verdict/);
});

it('synthesis schema declares the v1 payload shape', async () => {
  const schema = JSON.parse(await readFile(synthesisSchemaPath, 'utf8'));

  expect(schema.$id).toBe('consensus-plugin/v1/synthesis.schema.json');
  expect(schema.properties.schema_version.const).toBe('v1');
  expect(schema.required).toEqual([
    'schema_version',
    'synthesized_artifact',
    'synthesis_reasoning',
    'unresolved_disagreements',
  ]);
  expect(schema.properties.unresolved_disagreements.type).toBe('array');
  expect(JSON.stringify(schema).includes('maxLength')).toBe(false);
});

it('validateSynthesisShape accepts a complete v1 synthesis payload', () => {
  expect(validateSynthesisShape(validSynthesis())).toEqual({
    ok: true,
    errors: [],
  });
  expect(
    validateSynthesisShape(
      validSynthesis({ unresolved_disagreements: ['scope of section 2'] }),
    ),
  ).toEqual({ ok: true, errors: [] });
});

it('validateSynthesisShape rejects missing, mistyped, and extra fields', () => {
  expect(
    validateSynthesisShape(
      validSynthesis({ schema_version: 'v0' }),
    ).errors.join('\n'),
  ).toMatch(/schema_version/);
  expect(
    validateSynthesisShape(
      validSynthesis({ synthesized_artifact: 42 }),
    ).errors.join('\n'),
  ).toMatch(/synthesized_artifact/);
  expect(
    validateSynthesisShape(
      validSynthesis({ synthesis_reasoning: undefined }),
    ).errors.join('\n'),
  ).toMatch(/synthesis_reasoning/);
  expect(
    validateSynthesisShape({
      schema_version: 'v1',
      synthesized_artifact: 'x',
      synthesis_reasoning: 'y',
    }).errors.join('\n'),
  ).toMatch(/unresolved_disagreements/);
  expect(
    validateSynthesisShape(
      validSynthesis({ unresolved_disagreements: 'not an array' }),
    ).errors.join('\n'),
  ).toMatch(/unresolved_disagreements/);
  expect(
    validateSynthesisShape(
      validSynthesis({ unresolved_disagreements: [1, 2] }),
    ).errors.join('\n'),
  ).toMatch(/unresolved_disagreements\[0\]/);
  expect(
    validateSynthesisShape(validSynthesis({ extra: true })).errors.join('\n'),
  ).toMatch(/additional property: extra/);
  expect(validateSynthesisShape(null)).toEqual({
    ok: false,
    errors: ['synthesis must be an object'],
  });
});

it('SYNTHESIS_CAPS declares the synthesis byte budget', () => {
  expect(SYNTHESIS_CAPS.synthesized_artifact_bytes).toBe(256 * 1024);
  expect(SYNTHESIS_CAPS.synthesis_reasoning_bytes).toBe(16 * 1024);
  expect(SYNTHESIS_CAPS.disagreement_bytes).toBe(4 * 1024);
  expect(SYNTHESIS_CAPS.max_disagreements).toBe(20);
  expect(SYNTHESIS_CAPS.total_synthesis_bytes).toBe(512 * 1024);
});

it('validateSynthesisCaps enforces synthesis field byte caps with metadata-only results', () => {
  expect(validateSynthesisCaps(validSynthesis()).ok).toBe(true);

  const artifact = validateSynthesisCaps(
    validSynthesis({
      synthesized_artifact: 'x'.repeat(
        SYNTHESIS_CAPS.synthesized_artifact_bytes + 1,
      ),
    }),
  );
  expect(artifact.ok).toBe(false);
  expect(artifact.metadata).toEqual({
    code: 'OVERSIZE_REJECTED',
    field: 'synthesized_artifact',
    limit_bytes: SYNTHESIS_CAPS.synthesized_artifact_bytes,
    actual_bytes: SYNTHESIS_CAPS.synthesized_artifact_bytes + 1,
  });

  const reasoning = validateSynthesisCaps(
    validSynthesis({
      synthesis_reasoning: 'x'.repeat(
        SYNTHESIS_CAPS.synthesis_reasoning_bytes + 1,
      ),
    }),
  );
  expect(reasoning.ok).toBe(false);
  expect(reasoning.metadata.field).toBe('synthesis_reasoning');

  const disagreement = validateSynthesisCaps(
    validSynthesis({
      unresolved_disagreements: [
        'ok',
        'x'.repeat(SYNTHESIS_CAPS.disagreement_bytes + 1),
      ],
    }),
  );
  expect(disagreement.ok).toBe(false);
  expect(disagreement.metadata.field).toBe('unresolved_disagreements[1]');

  const tooMany = validateSynthesisCaps(
    validSynthesis({
      unresolved_disagreements: Array.from(
        { length: SYNTHESIS_CAPS.max_disagreements + 1 },
        () => 'small',
      ),
    }),
  );
  expect(tooMany.ok).toBe(false);
  expect(tooMany.metadata).toEqual({
    code: 'OVERSIZE_REJECTED',
    field: 'unresolved_disagreements',
    limit_count: SYNTHESIS_CAPS.max_disagreements,
    actual_count: SYNTHESIS_CAPS.max_disagreements + 1,
  });
});

it('validateSynthesisCaps enforces the total synthesis payload cap and runs shape first', () => {
  const total = validateSynthesisCaps(
    validSynthesis({
      synthesized_artifact: 'x'.repeat(SYNTHESIS_CAPS.total_synthesis_bytes),
    }),
  );
  expect(total.ok).toBe(false);
  expect(total.metadata.field).toBe('synthesis');

  const badShape = validateSynthesisCaps(
    validSynthesis({ schema_version: 'v0' }),
  );
  expect(badShape.ok).toBe(false);
  expect(badShape.errors.join('\n')).toMatch(/schema_version/);
});

it('validateVerdictCaps caps parallel critique fields like reasoning', () => {
  const ownOversize = validateVerdictCaps(
    parallelVerdict({
      critique: parallelCritique({
        own_previous: 'x'.repeat(VERDICT_CAPS.reasoning_bytes + 1),
      }),
    }),
    { mode: 'parallel_revision' },
  );
  expect(ownOversize.ok).toBe(false);
  expect(ownOversize.metadata).toEqual({
    code: 'OVERSIZE_REJECTED',
    field: 'critique.own_previous',
    limit_bytes: VERDICT_CAPS.reasoning_bytes,
    actual_bytes: VERDICT_CAPS.reasoning_bytes + 1,
  });

  const peerOversize = validateVerdictCaps(
    parallelVerdict({
      critique: parallelCritique({
        peer_previous: 'é'.repeat(VERDICT_CAPS.reasoning_bytes / 2 + 1),
      }),
    }),
    { mode: 'parallel_revision' },
  );
  expect(peerOversize.ok).toBe(false);
  expect(peerOversize.metadata.field).toBe('critique.peer_previous');
  expect(peerOversize.metadata.actual_bytes).toBe(
    VERDICT_CAPS.reasoning_bytes + 2,
  );

  const within = validateVerdictCaps(parallelVerdict(), {
    mode: 'parallel_revision',
  });
  expect(within.ok).toBe(true);
});

it('validateVerdictCaps total-verdict cap is enforced for parallel verdicts with critiques', () => {
  const total = validateVerdictCaps(
    parallelVerdict({
      proposed_artifact: 'x'.repeat(VERDICT_CAPS.total_verdict_bytes),
    }),
    { mode: 'parallel_revision' },
  );
  expect(total.ok).toBe(false);
  expect(total.metadata.field).toBe('verdict');
});

it('validateVerdictCaps applies UTF-8 byte caps after shape validation', () => {
  const accepted = validateVerdictCaps(
    validVerdict({ reasoning: 'é'.repeat(4) }),
  );
  expect(accepted.ok).toBe(true);

  const oversized = validateVerdictCaps(
    validVerdict({
      verdict: 'REVISE',
      proposed_artifact: 'x'.repeat(VERDICT_CAPS.proposed_artifact_bytes + 1),
    }),
  );

  expect(oversized.ok).toBe(false);
  expect(oversized.metadata).toEqual({
    code: 'OVERSIZE_REJECTED',
    field: 'proposed_artifact',
    limit_bytes: VERDICT_CAPS.proposed_artifact_bytes,
    actual_bytes: VERDICT_CAPS.proposed_artifact_bytes + 1,
  });
});

it('validateVerdictCaps reports oversized reasoning and concerns with byte counts', () => {
  const reasoning = validateVerdictCaps(
    validVerdict({ reasoning: 'x'.repeat(VERDICT_CAPS.reasoning_bytes + 1) }),
  );
  expect(reasoning.ok).toBe(false);
  expect(reasoning.metadata.field).toBe('reasoning');
  expect(reasoning.metadata.code).toBe('OVERSIZE_REJECTED');

  const concerns = validateVerdictCaps(
    validVerdict({
      verdict: 'IMPASSE',
      concerns: ['é'.repeat(VERDICT_CAPS.concern_bytes / 2 + 1)],
    }),
  );
  expect(concerns.ok).toBe(false);
  expect(concerns.metadata.field).toBe('concerns[0]');
  expect(concerns.metadata.actual_bytes).toBe(VERDICT_CAPS.concern_bytes + 2);
});

it('validateVerdictCaps enforces max concern count and total JSON payload caps', () => {
  const tooManyConcerns = validateVerdictCaps(
    validVerdict({
      concerns: Array.from(
        { length: VERDICT_CAPS.max_concerns + 1 },
        () => 'small',
      ),
    }),
  );
  expect(tooManyConcerns.ok).toBe(false);
  expect(tooManyConcerns.metadata).toEqual({
    code: 'OVERSIZE_REJECTED',
    field: 'concerns',
    limit_count: VERDICT_CAPS.max_concerns,
    actual_count: VERDICT_CAPS.max_concerns + 1,
  });

  const total = validateVerdictCaps(
    validVerdict({
      verdict: 'REVISE',
      proposed_artifact: 'x'.repeat(VERDICT_CAPS.total_verdict_bytes),
    }),
  );
  expect(total.ok).toBe(false);
  expect(total.metadata.field).toBe('verdict');
});
