import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusLoop from '../../../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
// @ts-expect-error The generated runtime is intentionally declaration-free; this test exercises the shipped artifact.
import * as consensusRefine from '../../../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const { ConsensusError, EXIT_CODES, exitCodeForError, runConsensusLoop } =
  consensusLoop;
const { createJsonlEvent, renderHumanError, runSequential, runWrapperCli } =
  consensusRefine;

type JsonRecord = Record<string, any>;

type RunFiles = {
  tempRoot: string;
  sectionPath: string;
  recordsPath: string;
  outputPath: string;
  statusPath: string;
};

const repoRoot = path.resolve(new URL('../../..', import.meta.url).pathname);
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk: string) {
        value += chunk;
      },
    },
    value() {
      return value;
    },
  };
}

function sectionFailOnceInvoker() {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('provider unavailable for first section');
    }
    return {
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'accepted',
      },
    };
  };
}

function sectionPartialFailureInvoker() {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) {
      return {
        json: {
          schema_version: 'v1',
          verdict: 'REVISE',
          reasoning: 'partial edit landed',
          proposed_artifact: 'Partially revised intro.\n',
        },
      };
    }
    if (calls === 2) {
      throw new Error('provider unavailable after first turn');
    }
    return {
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'accepted',
      },
    };
  };
}

function impasseThenAcceptInvoker() {
  let calls = 0;
  return async () => {
    calls += 1;
    if (calls === 1) {
      return {
        json: {
          schema_version: 'v1',
          verdict: 'IMPASSE',
          reasoning: 'needs user direction',
          concerns: ['unclear scope'],
        },
      };
    }
    return {
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'accepted',
      },
    };
  };
}

function extractLabeledJson(markdown: string, label: string): any {
  const fenced = markdown.match(
    new RegExp('```json ' + label + '\\n([\\s\\S]*?)\\n```'),
  );
  if (fenced) return JSON.parse(fenced[1]);

  const commented = markdown.match(
    new RegExp('<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->'),
  );
  expect(commented, `missing ${label} JSON block`).toBeTruthy();
  if (!commented) {
    throw new Error(`missing ${label} JSON block`);
  }
  return JSON.parse(commented[1]);
}

async function makeSynthesizedRunFiles() {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), 'consensus-synth-fail-'),
  );
  const sectionPath = path.join(tempRoot, 'section.md');
  await writeFile(sectionPath, 'Seed.\n');
  return {
    tempRoot,
    sectionPath,
    recordsPath: path.join(tempRoot, 'records.json'),
    outputPath: path.join(tempRoot, 'output.md'),
    statusPath: path.join(tempRoot, 'status.json'),
  };
}

function synthesizedArgv(files: RunFiles, extra: string[] = []) {
  return [
    '--section-file',
    files.sectionPath,
    '--goal',
    'Tighten.',
    '--peers',
    'claude,codex',
    '--iteration',
    'parallel_synthesized',
    '--synthesizer',
    'claude',
    '--max-rounds',
    '3',
    '--agency',
    'moderate',
    '--output-records',
    files.recordsPath,
    '--output-section',
    files.outputPath,
    '--output-status',
    files.statusPath,
    ...extra,
  ];
}

function divergentPeer() {
  let call = 0;
  return async () => {
    call += 1;
    return {
      json: {
        schema_version: 'v1',
        verdict: 'REVISE',
        reasoning: `r${call}`,
        critique: { own_previous: 'o', peer_previous: 'p' },
        proposed_artifact: `peer-${call}.\n`,
      },
      stdout: '{"id":"peer"}',
    };
  };
}

it('synthesis process failure leaves the peer pair durable and resumable (pending-synthesis)', async () => {
  const files = await makeSynthesizedRunFiles();

  await expect(
    runConsensusLoop(synthesizedArgv(files), {
      invokePeer: divergentPeer(),
      invokeSynthesizer: async () => {
        throw new Error('synthesizer spawn failed');
      },
    }),
  ).rejects.toThrow();

  const records: JsonRecord[] = JSON.parse(
    await readFile(files.recordsPath, 'utf8'),
  );
  // The peer pair is durable; NO synthesis or synthesis-error record was written.
  expect(records.length, 'exactly the peer pair is committed').toBe(2);
  expect(records.map((record) => record.agent)).toEqual(['claude', 'codex']);
  expect(records.some((record) => record.record_type === 'synthesis')).toBe(
    false,
  );
  expect(
    records.some((record) => record.record_type === 'synthesis-error'),
  ).toBe(false);
});

it('invalid synthesis shape writes a metadata-only synthesis-error record and errors the section', async () => {
  const files = await makeSynthesizedRunFiles();

  await expect(
    runConsensusLoop(synthesizedArgv(files), {
      invokePeer: divergentPeer(),
      invokeSynthesizer: async () => ({
        // Missing synthesis_reasoning + unresolved_disagreements.
        json: { schema_version: 'v1', synthesized_artifact: 'merged' },
        stdout: '{"id":"synth"}',
      }),
    }),
  ).rejects.toSatisfy((error: any) => {
    expect(error.code).toBe('INVALID_SYNTHESIS_SHAPE');
    return true;
  });

  const records: JsonRecord[] = JSON.parse(
    await readFile(files.recordsPath, 'utf8'),
  );
  const synthError = records.find(
    (record) => record.record_type === 'synthesis-error',
  );
  expect(synthError, 'a synthesis-error record is written').toBeTruthy();
  if (!synthError) {
    throw new Error('expected synthesis-error record');
  }
  expect(synthError.code).toBe('INVALID_SYNTHESIS_SHAPE');
  expect(synthError.synthesizer).toBe('claude');
  // Metadata only: no synthesized text leaks into the record.
  expect('synthesized_artifact' in synthError).toBe(false);

  const status = JSON.parse(await readFile(files.statusPath, 'utf8'));
  expect(status.status).toBe('error');
});

it('oversized synthesis writes a synthesis-error record with INVALID_SYNTHESIS_CAPS', async () => {
  const files = await makeSynthesizedRunFiles();
  const huge = 'x'.repeat(256 * 1024 + 1);

  await expect(
    runConsensusLoop(synthesizedArgv(files), {
      invokePeer: divergentPeer(),
      invokeSynthesizer: async () => ({
        json: {
          schema_version: 'v1',
          synthesized_artifact: huge,
          synthesis_reasoning: 'merged',
          unresolved_disagreements: [],
        },
        stdout: '{"id":"synth"}',
      }),
    }),
  ).rejects.toSatisfy((error: any) => {
    expect(error.code).toBe('INVALID_SYNTHESIS_CAPS');
    return true;
  });

  const records: JsonRecord[] = JSON.parse(
    await readFile(files.recordsPath, 'utf8'),
  );
  const synthError = records.find(
    (record) => record.record_type === 'synthesis-error',
  );
  expect(synthError).toBeTruthy();
  if (!synthError) {
    throw new Error('expected synthesis-error record');
  }
  expect(synthError.code).toBe('INVALID_SYNTHESIS_CAPS');
  expect('synthesized_artifact' in synthError).toBe(false);
});

it('createJsonlEvent returns stdout-safe JSONL event shape', () => {
  const event = createJsonlEvent(
    'run_started',
    { input_path: 'draft.md' },
    { now: () => '2026-05-04T03:00:00.000Z' },
  );

  expect(event).toEqual({
    consensus_schema_version: 'v1',
    event: 'run_started',
    timestamp: '2026-05-04T03:00:00.000Z',
    input_path: 'draft.md',
  });
  expect(() => JSON.parse(`${JSON.stringify(event)}\n`)).not.toThrow();
});

it('renderHumanError omits stacks unless trace logging is requested', () => {
  const error = new Error('plain failure');
  error.stack = 'STACK SHOULD NOT LEAK';

  expect(renderHumanError(error, {})).toBe('plain failure');
  expect(renderHumanError(error, { CONSENSUS_LOG: 'trace' })).toMatch(
    /STACK SHOULD NOT LEAK/,
  );
});

it('exitCodeForError maps unit-testable wrapper exit codes', () => {
  expect(
    exitCodeForError(
      new ConsensusError('usage', { exitCode: EXIT_CODES.USAGE }),
    ),
  ).toBe(64);
  expect(
    exitCodeForError(new ConsensusError('data', { exitCode: EXIT_CODES.DATA })),
  ).toBe(65);
  expect(
    exitCodeForError(Object.assign(new Error('io'), { code: 'ENOENT' })),
  ).toBe(73);
  expect(
    exitCodeForError(
      Object.assign(new Error('permission'), { code: 'EACCES' }),
    ),
  ).toBe(77);
  expect(
    exitCodeForError(Object.assign(new Error('permission'), { code: 'EPERM' })),
  ).toBe(77);
  expect(
    exitCodeForError(
      new ConsensusError('section', { exitCode: EXIT_CODES.SECTION_ERROR }),
    ),
  ).toBe(74);
  expect(
    exitCodeForError(
      Object.assign(new Error('missing'), { code: 'PASEO_MISSING' }),
    ),
  ).toBe(78);
  expect(
    exitCodeForError(
      Object.assign(new Error('peer'), { code: 'PEER_UNAVAILABLE' }),
    ),
  ).toBe(78);
  expect(
    exitCodeForError(
      Object.assign(new Error('node'), { code: 'NODE_TOO_OLD' }),
    ),
  ).toBe(78);
  expect(
    exitCodeForError(
      new ConsensusError('config', { exitCode: EXIT_CODES.CONFIG }),
    ),
  ).toBe(78);
  expect(
    exitCodeForError(
      Object.assign(new Error('interrupted'), { name: 'AbortError' }),
    ),
  ).toBe(130);
});

it('runWrapperCli writes JSONL to stdout and human errors to stderr', async () => {
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(['--max-rounds', '0'], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  expect(exitCode).toBe(EXIT_CODES.USAGE);
  const event = JSON.parse(stdout.value().trim());
  expect(event.event).toBe('error');
  expect(event.exit_code).toBe(EXIT_CODES.USAGE);
  expect(stderr.value()).toMatch(/--max-rounds must be between 1 and 100/);
  expect(stdout.value()).not.toMatch(/Error:/);
});

it('runWrapperCli keeps trace stacks out of stdout JSONL', async () => {
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(['--max-rounds', '0'], {
    stdout: stdout.stream,
    stderr: stderr.stream,
    env: { CONSENSUS_LOG: 'trace' },
  });

  expect(exitCode).toBe(EXIT_CODES.USAGE);
  const event = JSON.parse(stdout.value().trim());
  expect(event.message).toBe('--max-rounds must be between 1 and 100');
  expect(stdout.value()).not.toMatch(/at parseWrapperArgs/);
  expect(stderr.value()).toMatch(/at parseWrapperArgs/);
});

it('runSequential aggregates section errors without aborting unrelated sections', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-errors-'));
  const result = await runSequential({
    inputPath: sampleInput,
    output: path.join(tempRoot, 'out.md'),
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Handle errors.',
    peers: ['claude', 'codex'],
    maxRounds: 1,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    invokePeer: sectionFailOnceInvoker(),
  });

  expect(result.status).toBe('error');
  expect(result.sections.length).toBe(3);
  expect(result.sections[0].status.status).toBe('error');
  expect(result.sections[1].status.status).toBe('converged');
  expect(result.sections[2].status.status).toBe('converged');
});

it('runSequential preserves partial records and status after a section hard error', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-errors-'));
  const result = await runSequential({
    inputPath: sampleInput,
    output: path.join(tempRoot, 'out.md'),
    runDir: path.join(tempRoot, '.consensus/run'),
    allowRoot: tempRoot,
    cwd: tempRoot,
    goal: 'Handle partial errors.',
    peers: ['claude', 'codex'],
    maxRounds: 2,
    agency: 'moderate',
    preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
    invokePeer: sectionPartialFailureInvoker(),
  });

  const failed = result.sections[0];
  expect(result.status).toBe('error');
  expect(failed.status.status).toBe('error');
  expect(failed.status.turns).toBe(1);
  expect(failed.status.rounds).toBe(1);
  expect(failed.records.length).toBe(1);
  expect(failed.records[0].reasoning).toBe('partial edit landed');
  expect(failed.output).toBe('Partially revised intro.\n');
  expect(result.artifact).toMatch(/Partially revised intro\./);
  expect(result.artifact).toMatch(/partial edit landed/);
});

it('runSequential honors --fail-on-section-error with exit 74 semantics', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-errors-'));
  const outputPath = path.join(tempRoot, 'out.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  let thrown: any;

  try {
    await runSequential({
      inputPath: sampleInput,
      output: outputPath,
      runDir,
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Handle errors.',
      peers: ['claude', 'codex'],
      maxRounds: 1,
      agency: 'moderate',
      failOnSectionError: true,
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
      invokePeer: sectionFailOnceInvoker(),
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeTruthy();
  expect(exitCodeForError(thrown)).toBe(EXIT_CODES.SECTION_ERROR);
  expect(thrown.message).toMatch(/section error or impasse/i);
  expect(thrown.details.output_path).toBe(outputPath);
  expect(thrown.details.run_dir).toBe(runDir);
  expect((await stat(outputPath)).isFile()).toBe(true);

  const artifact = await readFile(outputPath, 'utf8');
  const sectionStates = extractLabeledJson(
    artifact,
    'consensus-section-states',
  );
  expect(sectionStates.map((section: JsonRecord) => section.status)).toEqual([
    'error',
    'converged',
    'converged',
  ]);
  expect(artifact).toMatch(/## Details/);
  expect(artifact).toMatch(/## Close/);
});

it('runSequential treats impasse as a section error after writing the artifact', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-errors-'));
  const outputPath = path.join(tempRoot, 'out.md');
  let thrown: any;

  try {
    await runSequential({
      inputPath: sampleInput,
      output: outputPath,
      runDir: path.join(tempRoot, '.consensus/run'),
      allowRoot: tempRoot,
      cwd: tempRoot,
      goal: 'Handle impasse.',
      peers: ['claude', 'codex'],
      maxRounds: 1,
      agency: 'moderate',
      failOnSectionError: true,
      preflight: async () => ({ peers: ['claude', 'codex'], warnings: [] }),
      invokePeer: impasseThenAcceptInvoker(),
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeTruthy();
  expect(exitCodeForError(thrown)).toBe(EXIT_CODES.SECTION_ERROR);
  expect((await stat(outputPath)).isFile()).toBe(true);

  const artifact = await readFile(outputPath, 'utf8');
  const sectionStates = extractLabeledJson(
    artifact,
    'consensus-section-states',
  );
  expect(sectionStates.map((section: JsonRecord) => section.status)).toEqual([
    'impasse',
    'converged',
    'converged',
  ]);
});
