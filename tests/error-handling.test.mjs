import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ConsensusError,
  EXIT_CODES,
  exitCodeForError,
  runConsensusLoop
} from '../plugins/consensus/skills/refine/scripts/consensus-loop.mjs';
import {
  createJsonlEvent,
  renderHumanError,
  runSequential,
  runWrapperCli
} from '../plugins/consensus/skills/refine/scripts/consensus-refine.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const sampleInput = path.join(repoRoot, 'tests/fixtures/sample-input.md');

function captureWriter() {
  let value = '';
  return {
    stream: {
      write(chunk) {
        value += chunk;
      }
    },
    value() {
      return value;
    }
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
        reasoning: 'accepted'
      }
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
          proposed_artifact: 'Partially revised intro.\n'
        }
      };
    }
    if (calls === 2) {
      throw new Error('provider unavailable after first turn');
    }
    return {
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'accepted'
      }
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
          concerns: ['unclear scope']
        }
      };
    }
    return {
      json: {
        schema_version: 'v1',
        verdict: 'ACCEPT',
        reasoning: 'accepted'
      }
    };
  };
}

function extractLabeledJson(markdown, label) {
  const fenced = markdown.match(new RegExp('```json ' + label + '\\n([\\s\\S]*?)\\n```'));
  if (fenced) return JSON.parse(fenced[1]);

  const commented = markdown.match(new RegExp('<!-- consensus:' + label + '\\n([\\s\\S]*?)\\n-->'));
  assert.ok(commented, `missing ${label} JSON block`);
  return JSON.parse(commented[1]);
}

async function makeSynthesizedRunFiles() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-synth-fail-'));
  const sectionPath = path.join(tempRoot, 'section.md');
  await writeFile(sectionPath, 'Seed.\n');
  return {
    tempRoot,
    sectionPath,
    recordsPath: path.join(tempRoot, 'records.json'),
    outputPath: path.join(tempRoot, 'output.md'),
    statusPath: path.join(tempRoot, 'status.json')
  };
}

function synthesizedArgv(files, extra = []) {
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
    ...extra
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
        proposed_artifact: `peer-${call}.\n`
      },
      stdout: '{"id":"peer"}'
    };
  };
}

test('synthesis process failure leaves the peer pair durable and resumable (pending-synthesis)', async () => {
  const files = await makeSynthesizedRunFiles();

  await assert.rejects(
    runConsensusLoop(synthesizedArgv(files), {
      invokePeer: divergentPeer(),
      invokeSynthesizer: async () => {
        throw new Error('synthesizer spawn failed');
      }
    })
  );

  const records = JSON.parse(await readFile(files.recordsPath, 'utf8'));
  // The peer pair is durable; NO synthesis or synthesis-error record was written.
  assert.equal(records.length, 2, 'exactly the peer pair is committed');
  assert.deepEqual(records.map((record) => record.agent), ['claude', 'codex']);
  assert.equal(records.some((record) => record.record_type === 'synthesis'), false);
  assert.equal(records.some((record) => record.record_type === 'synthesis-error'), false);
});

test('invalid synthesis shape writes a metadata-only synthesis-error record and errors the section', async () => {
  const files = await makeSynthesizedRunFiles();

  await assert.rejects(
    runConsensusLoop(synthesizedArgv(files), {
      invokePeer: divergentPeer(),
      invokeSynthesizer: async () => ({
        // Missing synthesis_reasoning + unresolved_disagreements.
        json: { schema_version: 'v1', synthesized_artifact: 'merged' },
        stdout: '{"id":"synth"}'
      })
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_SYNTHESIS_SHAPE');
      return true;
    }
  );

  const records = JSON.parse(await readFile(files.recordsPath, 'utf8'));
  const synthError = records.find((record) => record.record_type === 'synthesis-error');
  assert.ok(synthError, 'a synthesis-error record is written');
  assert.equal(synthError.code, 'INVALID_SYNTHESIS_SHAPE');
  assert.equal(synthError.synthesizer, 'claude');
  // Metadata only: no synthesized text leaks into the record.
  assert.equal('synthesized_artifact' in synthError, false);

  const status = JSON.parse(await readFile(files.statusPath, 'utf8'));
  assert.equal(status.status, 'error');
});

test('oversized synthesis writes a synthesis-error record with INVALID_SYNTHESIS_CAPS', async () => {
  const files = await makeSynthesizedRunFiles();
  const huge = 'x'.repeat(256 * 1024 + 1);

  await assert.rejects(
    runConsensusLoop(synthesizedArgv(files), {
      invokePeer: divergentPeer(),
      invokeSynthesizer: async () => ({
        json: {
          schema_version: 'v1',
          synthesized_artifact: huge,
          synthesis_reasoning: 'merged',
          unresolved_disagreements: []
        },
        stdout: '{"id":"synth"}'
      })
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_SYNTHESIS_CAPS');
      return true;
    }
  );

  const records = JSON.parse(await readFile(files.recordsPath, 'utf8'));
  const synthError = records.find((record) => record.record_type === 'synthesis-error');
  assert.ok(synthError);
  assert.equal(synthError.code, 'INVALID_SYNTHESIS_CAPS');
  assert.equal('synthesized_artifact' in synthError, false);
});

test('createJsonlEvent returns stdout-safe JSONL event shape', () => {
  const event = createJsonlEvent('run_started', { input_path: 'draft.md' }, { now: () => '2026-05-04T03:00:00.000Z' });

  assert.deepEqual(event, {
    consensus_schema_version: 'v0',
    event: 'run_started',
    timestamp: '2026-05-04T03:00:00.000Z',
    input_path: 'draft.md'
  });
  assert.doesNotThrow(() => JSON.parse(`${JSON.stringify(event)}\n`));
});

test('renderHumanError omits stacks unless trace logging is requested', () => {
  const error = new Error('plain failure');
  error.stack = 'STACK SHOULD NOT LEAK';

  assert.equal(renderHumanError(error, {}), 'plain failure');
  assert.match(renderHumanError(error, { CONSENSUS_LOG: 'trace' }), /STACK SHOULD NOT LEAK/);
});

test('exitCodeForError maps unit-testable wrapper exit codes', () => {
  assert.equal(exitCodeForError(new ConsensusError('usage', { exitCode: EXIT_CODES.USAGE })), 64);
  assert.equal(exitCodeForError(new ConsensusError('data', { exitCode: EXIT_CODES.DATA })), 65);
  assert.equal(exitCodeForError(Object.assign(new Error('io'), { code: 'ENOENT' })), 73);
  assert.equal(exitCodeForError(Object.assign(new Error('permission'), { code: 'EACCES' })), 77);
  assert.equal(exitCodeForError(Object.assign(new Error('permission'), { code: 'EPERM' })), 77);
  assert.equal(exitCodeForError(new ConsensusError('section', { exitCode: EXIT_CODES.SECTION_ERROR })), 74);
  assert.equal(exitCodeForError(Object.assign(new Error('missing'), { code: 'PASEO_MISSING' })), 78);
  assert.equal(exitCodeForError(Object.assign(new Error('peer'), { code: 'PEER_UNAVAILABLE' })), 78);
  assert.equal(exitCodeForError(Object.assign(new Error('node'), { code: 'NODE_TOO_OLD' })), 78);
  assert.equal(exitCodeForError(new ConsensusError('config', { exitCode: EXIT_CODES.CONFIG })), 78);
  assert.equal(exitCodeForError(Object.assign(new Error('interrupted'), { name: 'AbortError' })), 130);
});

test('runWrapperCli writes JSONL to stdout and human errors to stderr', async () => {
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(['--max-rounds', '0'], { stdout: stdout.stream, stderr: stderr.stream });

  assert.equal(exitCode, EXIT_CODES.USAGE);
  const event = JSON.parse(stdout.value().trim());
  assert.equal(event.event, 'error');
  assert.equal(event.exit_code, EXIT_CODES.USAGE);
  assert.match(stderr.value(), /--max-rounds must be between 1 and 100/);
  assert.doesNotMatch(stdout.value(), /Error:/);
});

test('runWrapperCli keeps trace stacks out of stdout JSONL', async () => {
  const stdout = captureWriter();
  const stderr = captureWriter();
  const exitCode = await runWrapperCli(['--max-rounds', '0'], {
    stdout: stdout.stream,
    stderr: stderr.stream,
    env: { CONSENSUS_LOG: 'trace' }
  });

  assert.equal(exitCode, EXIT_CODES.USAGE);
  const event = JSON.parse(stdout.value().trim());
  assert.equal(event.message, '--max-rounds must be between 1 and 100');
  assert.doesNotMatch(stdout.value(), /at parseWrapperArgs/);
  assert.match(stderr.value(), /at parseWrapperArgs/);
});

test('runSequential aggregates section errors without aborting unrelated sections', async () => {
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
    invokePeer: sectionFailOnceInvoker()
  });

  assert.equal(result.status, 'error');
  assert.equal(result.sections.length, 3);
  assert.equal(result.sections[0].status.status, 'error');
  assert.equal(result.sections[1].status.status, 'converged');
  assert.equal(result.sections[2].status.status, 'converged');
});

test('runSequential preserves partial records and status after a section hard error', async () => {
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
    invokePeer: sectionPartialFailureInvoker()
  });

  const failed = result.sections[0];
  assert.equal(result.status, 'error');
  assert.equal(failed.status.status, 'error');
  assert.equal(failed.status.turns, 1);
  assert.equal(failed.status.rounds, 1);
  assert.equal(failed.records.length, 1);
  assert.equal(failed.records[0].reasoning, 'partial edit landed');
  assert.equal(failed.output, 'Partially revised intro.\n');
  assert.match(result.artifact, /Partially revised intro\./);
  assert.match(result.artifact, /partial edit landed/);
});

test('runSequential honors --fail-on-section-error with exit 74 semantics', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-errors-'));
  const outputPath = path.join(tempRoot, 'out.md');
  const runDir = path.join(tempRoot, '.consensus/run');
  let thrown;

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
      invokePeer: sectionFailOnceInvoker()
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown);
  assert.equal(exitCodeForError(thrown), EXIT_CODES.SECTION_ERROR);
  assert.match(thrown.message, /section error or impasse/i);
  assert.equal(thrown.details.output_path, outputPath);
  assert.equal(thrown.details.run_dir, runDir);
  assert.equal((await stat(outputPath)).isFile(), true);

  const artifact = await readFile(outputPath, 'utf8');
  const sectionStates = extractLabeledJson(artifact, 'consensus-section-states');
  assert.deepEqual(
    sectionStates.map((section) => section.status),
    ['error', 'converged', 'converged']
  );
  assert.match(artifact, /## Details/);
  assert.match(artifact, /## Close/);
});

test('runSequential treats impasse as a section error after writing the artifact', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-errors-'));
  const outputPath = path.join(tempRoot, 'out.md');
  let thrown;

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
      invokePeer: impasseThenAcceptInvoker()
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown);
  assert.equal(exitCodeForError(thrown), EXIT_CODES.SECTION_ERROR);
  assert.equal((await stat(outputPath)).isFile(), true);

  const artifact = await readFile(outputPath, 'utf8');
  const sectionStates = extractLabeledJson(artifact, 'consensus-section-states');
  assert.deepEqual(
    sectionStates.map((section) => section.status),
    ['impasse', 'converged', 'converged']
  );
});
