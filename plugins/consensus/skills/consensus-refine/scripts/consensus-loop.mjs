import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERDICT_CAPS = Object.freeze({
  reasoning_bytes: 64 * 1024,
  proposed_artifact_bytes: 1024 * 1024,
  concern_bytes: 16 * 1024,
  concerns_total_bytes: 64 * 1024
});

export const LOOP_SCHEMA_VERSION = 'v0';
export const SUBPROCESS_OUTPUT_CAP_BYTES = 10 * 1024 * 1024;

const DEFAULT_NORMALIZE_OPTIONS = {
  normalizeLineEndings: true,
  trimTrailingWhitespace: true,
  collapseEofNewlines: true,
  finalNewline: true
};

const VERDICT_BRANCHES = {
  ACCEPT: {
    required: ['schema_version', 'decision', 'reasoning'],
    optional: ['concerns']
  },
  REVISE: {
    required: ['schema_version', 'decision', 'reasoning', 'proposed_artifact'],
    optional: ['concerns']
  },
  IMPASSE: {
    required: ['schema_version', 'decision', 'reasoning', 'concerns'],
    optional: []
  }
};

function normalizeOptions(options = {}) {
  return { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
}

function verdictDecision(record) {
  return record?.verdict?.decision ?? record?.decision ?? null;
}

function byteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function oversizedResult(field, limitBytes, actualBytes) {
  return {
    ok: false,
    metadata: {
      code: 'OVERSIZE_REJECTED',
      field,
      limit_bytes: limitBytes,
      actual_bytes: actualBytes
    }
  };
}

function pushTypeError(errors, field, expected) {
  errors.push(`${field} must be ${expected}`);
}

function timestamp(options = {}) {
  return options.now?.() ?? new Date().toISOString();
}

function withRecordMetadata(record, options = {}) {
  return {
    schema_version: LOOP_SCHEMA_VERSION,
    recorded_at: timestamp(options),
    ...record
  };
}

async function readExistingRecords(recordsPath) {
  try {
    const parsed = JSON.parse(await readFile(recordsPath, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('records file must contain a JSON array');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function syncFileIfAvailable(filePath) {
  let handle;
  try {
    handle = await open(filePath, 'r');
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

function normalizeCost(status) {
  const source = status.cost_source ?? status.cost?.source ?? 'unavailable';
  const normalized = ['paseo', 'estimated', 'unavailable'].includes(source) ? source : 'unavailable';
  const costUsd = status.cost_usd ?? status.cost?.usd;

  if (normalized === 'unavailable' || typeof costUsd !== 'number') {
    return { cost_source: normalized };
  }

  return { cost_source: normalized, cost_usd: costUsd };
}

function roundCount(turns, peerCount) {
  if (turns === 0) return 0;
  return Math.ceil(turns / peerCount);
}

function required(value, name) {
  if (!value) {
    throw new Error(`missing required option: ${name}`);
  }
  return value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parsePeers(value) {
  const peers = String(required(value, '--peers'))
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);

  if (peers.length !== 2) {
    throw new Error('--peers must contain exactly two peers');
  }

  return peers;
}

function schemaPath() {
  return fileURLToPath(new URL('../schemas/verdict-alternating.schema.json', import.meta.url));
}

function hardErrorMessage(error) {
  return error?.message ?? String(error);
}

function outputCapError(streamName, capBytes) {
  const error = new Error(`${streamName} exceeded subprocess output cap (${capBytes} bytes)`);
  error.code = 'SUBPROCESS_OUTPUT_CAP';
  error.stream = streamName;
  return error;
}

function recordHash(record, options = {}) {
  if (record?.artifact_hash) return record.artifact_hash;
  if (record?.artifactHash) return record.artifactHash;
  if (typeof record?.artifact === 'string') return hashArtifact(record.artifact, options);
  if (typeof record?.proposed_artifact === 'string') return hashArtifact(record.proposed_artifact, options);
  if (typeof record?.verdict?.proposed_artifact === 'string') {
    return hashArtifact(record.verdict.proposed_artifact, options);
  }
  return null;
}

export function normalizeForHash(text, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  let normalized = String(text ?? '');

  if (normalizedOptions.normalizeLineEndings) {
    normalized = normalized.replace(/\r\n?/g, '\n');
  }

  if (normalizedOptions.trimTrailingWhitespace) {
    normalized = normalized
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n');
  }

  if (normalizedOptions.collapseEofNewlines) {
    normalized = normalized.replace(/\n+$/g, '');
  }

  if (normalizedOptions.finalNewline && normalized.length > 0) {
    normalized += '\n';
  }

  return normalized;
}

export function hashArtifact(text, options = {}) {
  return createHash('sha256').update(normalizeForHash(text, options), 'utf8').digest('hex');
}

export function validateVerdictShape(verdict) {
  const errors = [];

  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) {
    return { ok: false, errors: ['verdict must be an object'] };
  }

  if (verdict.schema_version !== 'v0') {
    errors.push('schema_version must be "v0"');
  }

  const branch = VERDICT_BRANCHES[verdict.decision];
  if (!branch) {
    errors.push('decision must be ACCEPT, REVISE, or IMPASSE');
  }

  if (!branch) {
    return { ok: false, errors };
  }

  const allowed = new Set([...branch.required, ...branch.optional]);
  for (const key of Object.keys(verdict)) {
    if (!allowed.has(key)) {
      errors.push(`additional property: ${key}`);
    }
  }

  for (const key of branch.required) {
    if (!(key in verdict)) {
      errors.push(`missing required property: ${key}`);
    }
  }

  if ('reasoning' in verdict && typeof verdict.reasoning !== 'string') {
    pushTypeError(errors, 'reasoning', 'a string');
  }

  if ('proposed_artifact' in verdict && typeof verdict.proposed_artifact !== 'string') {
    pushTypeError(errors, 'proposed_artifact', 'a string');
  }

  if ('concerns' in verdict) {
    if (!Array.isArray(verdict.concerns)) {
      pushTypeError(errors, 'concerns', 'an array');
    } else if (verdict.decision === 'IMPASSE' && verdict.concerns.length === 0) {
      errors.push('concerns must include at least one entry for IMPASSE');
    } else {
      verdict.concerns.forEach((concern, index) => {
        if (typeof concern !== 'string') {
          pushTypeError(errors, `concerns[${index}]`, 'a string');
        }
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateVerdictCaps(verdict) {
  const shape = validateVerdictShape(verdict);
  if (!shape.ok) return shape;

  const reasoningBytes = byteLength(verdict.reasoning);
  if (reasoningBytes > VERDICT_CAPS.reasoning_bytes) {
    return oversizedResult('reasoning', VERDICT_CAPS.reasoning_bytes, reasoningBytes);
  }

  if ('proposed_artifact' in verdict) {
    const proposedBytes = byteLength(verdict.proposed_artifact);
    if (proposedBytes > VERDICT_CAPS.proposed_artifact_bytes) {
      return oversizedResult('proposed_artifact', VERDICT_CAPS.proposed_artifact_bytes, proposedBytes);
    }
  }

  if (Array.isArray(verdict.concerns)) {
    let totalBytes = 0;
    for (const [index, concern] of verdict.concerns.entries()) {
      const concernBytes = byteLength(concern);
      if (concernBytes > VERDICT_CAPS.concern_bytes) {
        return oversizedResult(`concerns[${index}]`, VERDICT_CAPS.concern_bytes, concernBytes);
      }
      totalBytes += concernBytes;
    }

    if (totalBytes > VERDICT_CAPS.concerns_total_bytes) {
      return oversizedResult('concerns', VERDICT_CAPS.concerns_total_bytes, totalBytes);
    }
  }

  return { ok: true, errors: [] };
}

export async function createRecordsWriter(recordsPath, options = {}) {
  await mkdir(path.dirname(recordsPath), { recursive: true });
  const records = await readExistingRecords(recordsPath);

  async function flush() {
    await writeFile(recordsPath, `${JSON.stringify(records, null, 2)}\n`);
    await syncFileIfAvailable(recordsPath);
  }

  if (records.length === 0) {
    await flush();
  }

  return {
    path: recordsPath,
    async append(record) {
      const entry = withRecordMetadata(record, options);
      records.push(entry);
      await flush();
      return entry;
    },
    async close() {
      await flush();
    }
  };
}

export async function writeLoopStatus(statusPath, status, options = {}) {
  await mkdir(path.dirname(statusPath), { recursive: true });
  const reserved = new Set([
    'schema_version',
    'written_at',
    'status',
    'termination_reason',
    'turns',
    'rounds',
    'peers',
    'cost',
    'cost_source',
    'cost_usd'
  ]);
  const normalizedStatus = {
    schema_version: LOOP_SCHEMA_VERSION,
    written_at: timestamp(options),
    status: status.status,
    termination_reason: status.termination_reason ?? null,
    turns: status.turns ?? 0,
    rounds: status.rounds ?? 0
  };

  if (status.peers) {
    normalizedStatus.peers = status.peers;
  }

  for (const [key, value] of Object.entries(status)) {
    if (!reserved.has(key)) {
      normalizedStatus[key] = value;
    }
  }

  Object.assign(normalizedStatus, normalizeCost(status));

  await writeFile(statusPath, `${JSON.stringify(normalizedStatus, null, 2)}\n`);
  await syncFileIfAvailable(statusPath);
  return normalizedStatus;
}

export function invokePaseo({ provider, schemaPath, prompt, env = process.env, cwd = process.cwd() }) {
  return new Promise((resolve, reject) => {
    const args = ['run', '--provider', provider, '--output-schema', schemaPath, '--json', prompt];
    const child = spawn('paseo', args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let capError = null;

    function capture(streamName, chunks, chunk) {
      if (capError) return;

      const nextBytes = streamName === 'stdout' ? stdoutBytes + chunk.length : stderrBytes + chunk.length;
      if (nextBytes > SUBPROCESS_OUTPUT_CAP_BYTES) {
        capError = outputCapError(streamName, SUBPROCESS_OUTPUT_CAP_BYTES);
        child.kill('SIGKILL');
        return;
      }

      chunks.push(chunk);
      if (streamName === 'stdout') {
        stdoutBytes = nextBytes;
      } else {
        stderrBytes = nextBytes;
      }
    }

    child.stdout.on('data', (chunk) => capture('stdout', stdoutChunks, chunk));
    child.stderr.on('data', (chunk) => capture('stderr', stderrChunks, chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (capError) {
        reject(capError);
        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      if (code !== 0) {
        const detail = stderr.trim() ? `: ${stderr.trim()}` : signal ? ` (signal ${signal})` : '';
        const error = new Error(`paseo exited with code ${code}${detail}`);
        error.code = 'PASEO_EXIT';
        error.exitCode = code;
        error.stderr = stderr;
        reject(error);
        return;
      }

      try {
        resolve({
          provider,
          args,
          stdout,
          stderr,
          json: JSON.parse(stdout)
        });
      } catch (error) {
        error.message = `paseo returned invalid JSON: ${error.message}`;
        error.code = 'PASEO_INVALID_JSON';
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

export function parseLoopArgs(argv) {
  const parsed = {
    goal: '',
    maxRounds: 12,
    iteration: 'alternating',
    coldStart: 'shared_input',
    agency: 'moderate'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`${token} requires a value`);
      }
      return argv[index];
    };

    switch (token) {
      case '--section-file':
        parsed.sectionFile = next();
        break;
      case '--goal':
        parsed.goal = next();
        break;
      case '--peers':
        parsed.peers = parsePeers(next());
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(next(), '--max-rounds');
        break;
      case '--iteration':
        parsed.iteration = next();
        break;
      case '--cold-start':
        parsed.coldStart = next();
        break;
      case '--agency':
        parsed.agency = next();
        break;
      case '--output-records':
        parsed.outputRecords = next();
        break;
      case '--output-section':
        parsed.outputSection = next();
        break;
      case '--output-status':
        parsed.outputStatus = next();
        break;
      default:
        throw new Error(`unknown option: ${token}`);
    }
  }

  if (parsed.iteration !== 'alternating') {
    throw new Error('--iteration must be alternating');
  }
  if (parsed.coldStart !== 'shared_input') {
    throw new Error('--cold-start must be shared_input');
  }
  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  required(parsed.sectionFile, '--section-file');
  required(parsed.peers, '--peers');
  required(parsed.outputRecords, '--output-records');
  required(parsed.outputSection, '--output-section');
  required(parsed.outputStatus, '--output-status');

  return parsed;
}

export function buildTurnPrompt({ provider, peerIndex, round, turn, goal, artifact }) {
  const artifactBlock = artifact.replace(/\n*$/u, '\n');

  return [
    `You are ${provider}, consensus peer ${peerIndex + 1}.`,
    `Round: ${round}. Turn: ${turn}.`,
    '',
    'Goal:',
    goal || '(no explicit goal provided)',
    '',
    'Current artifact:',
    `\`\`\`markdown\n${artifactBlock}\`\`\``,
    '',
    'Return only JSON matching the alternating consensus verdict schema.',
    'Use decision ACCEPT when the artifact already satisfies the goal.',
    'Use decision REVISE with proposed_artifact when you can improve it.',
    'Use decision IMPASSE with concerns when the disagreement needs user direction.'
  ].join('\n');
}

async function writeSectionOutput(outputPath, artifact) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, artifact);
  await syncFileIfAvailable(outputPath);
}

async function writeTerminalArtifacts(options, status, artifact, records) {
  await writeSectionOutput(options.outputSection, artifact);
  const normalizedStatus = await writeLoopStatus(options.outputStatus, status);
  return {
    status: normalizedStatus,
    output: artifact,
    records
  };
}

function resultStatus(status, terminationReason, records, options, extra = {}) {
  const turns = records.length;
  return {
    status,
    termination_reason: terminationReason,
    turns,
    rounds: roundCount(turns, options.peers.length),
    peers: options.peers,
    agency: options.agency,
    iteration: options.iteration,
    cold_start: options.coldStart,
    ...extra
  };
}

export async function runConsensusLoop(argv, runOptions = {}) {
  const options = Array.isArray(argv) ? parseLoopArgs(argv) : argv;
  const records = [];
  const writer = await createRecordsWriter(options.outputRecords, runOptions);
  let currentArtifact = await readFile(options.sectionFile, 'utf8');
  const maxTurns = options.maxRounds * options.peers.length;
  const invokePeer =
    runOptions.invokePeer ??
    ((turn) =>
      invokePaseo({
        provider: turn.provider,
        schemaPath: schemaPath(),
        prompt: turn.prompt,
        env: runOptions.env ?? process.env,
        cwd: runOptions.cwd ?? process.cwd()
      }));

  try {
    for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
      const peerIndex = turnIndex % options.peers.length;
      const provider = options.peers[peerIndex];
      const turn = turnIndex + 1;
      const round = Math.floor(turnIndex / options.peers.length) + 1;
      const prompt = buildTurnPrompt({
        provider,
        peerIndex,
        round,
        turn,
        goal: options.goal,
        artifact: currentArtifact
      });
      const peerResult = await invokePeer({ provider, peerIndex, round, turn, prompt, artifact: currentArtifact });
      const verdict = peerResult.json;
      const shape = validateVerdictShape(verdict);
      if (!shape.ok) {
        throw new Error(`invalid verdict shape: ${shape.errors.join('; ')}`);
      }

      const caps = validateVerdictCaps(verdict);
      if (!caps.ok) {
        throw new Error(`invalid verdict caps: ${JSON.stringify(caps.metadata)}`);
      }

      if (verdict.decision === 'REVISE') {
        currentArtifact = verdict.proposed_artifact;
      }

      const record = await writer.append({
        turn,
        round,
        agent: provider,
        provider,
        verdict,
        artifact: currentArtifact,
        artifact_hash: hashArtifact(currentArtifact),
        raw_paseo_response: peerResult.json
      });
      records.push(record);

      if (verdict.decision === 'IMPASSE') {
        const status = resultStatus('impasse', 'explicit_impasse', records, options, {
          artifact_hash: hashArtifact(currentArtifact)
        });
        return await writeTerminalArtifacts(options, status, currentArtifact, records);
      }

      const convergence = detectConvergence(records);
      if (convergence.converged) {
        const status = resultStatus('converged', convergence.reason, records, options, {
          artifact_hash: convergence.artifact_hash
        });
        return await writeTerminalArtifacts(options, status, currentArtifact, records);
      }

      const oscillation = detectOscillation(records);
      if (oscillation.oscillating) {
        const status = resultStatus('impasse', 'oscillation', records, options, {
          artifact_hash: hashArtifact(currentArtifact),
          oscillation_hashes: oscillation.hashes
        });
        return await writeTerminalArtifacts(options, status, currentArtifact, records);
      }
    }

    const statusName = options.agency === 'maximum' ? 'converged' : 'max_rounds';
    const terminationReason = options.agency === 'maximum' ? 'agency_maximum_accept_last' : 'max_rounds';
    const status = resultStatus(statusName, terminationReason, records, options, {
      artifact_hash: hashArtifact(currentArtifact)
    });
    return await writeTerminalArtifacts(options, status, currentArtifact, records);
  } catch (error) {
    const status = resultStatus('error', 'hard_error', records, options, {
      error: hardErrorMessage(error)
    });
    await writeLoopStatus(options.outputStatus, status);
    throw error;
  } finally {
    await writer.close();
  }
}

export function detectConvergence(records, options = {}) {
  if (!Array.isArray(records) || records.length < 2) {
    return { converged: false, reason: null };
  }

  const rightIndex = records.length - 1;
  const leftIndex = records.length - 2;
  const left = records[leftIndex];
  const right = records[rightIndex];
  const leftHash = recordHash(left, options);
  const rightHash = recordHash(right, options);

  if (!leftHash || !rightHash || leftHash !== rightHash) {
    return { converged: false, reason: null };
  }

  const leftDecision = verdictDecision(left);
  const rightDecision = verdictDecision(right);
  const reason =
    leftDecision === 'ACCEPT' && rightDecision === 'ACCEPT' ? 'double_accept_same_hash' : 'hash_match';

  return {
    converged: true,
    reason,
    record_indexes: [leftIndex, rightIndex],
    artifact_hash: rightHash
  };
}

export function detectOscillation(records) {
  if (!Array.isArray(records) || records.length < 4) {
    return { oscillating: false, reason: null };
  }

  for (let end = records.length; end >= 4; end -= 1) {
    const window = records.slice(end - 4, end);
    const hashes = window.map((record) => recordHash(record));
    if (hashes.every(Boolean) && hashes[0] === hashes[2] && hashes[1] === hashes[3] && hashes[0] !== hashes[1]) {
      return {
        oscillating: true,
        reason: 'two_state_oscillation',
        record_indexes: [end - 4, end - 3, end - 2, end - 1],
        hashes: [hashes[0], hashes[1]]
      };
    }
  }

  return { oscillating: false, reason: null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runConsensusLoop(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${hardErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
