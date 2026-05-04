import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const MIN_PASEO_VERSION = '0.1.0';
export const MAX_TESTED_PASEO_VERSION = '0.9.0';

const MAX_ROUNDS_MIN = 1;
const MAX_ROUNDS_MAX = 100;
const PASEO_REMEDIATION = Object.freeze({
  install_command: 'npm install -g @getpaseo/cli',
  source_url: 'https://github.com/getpaseo/paseo',
  install_script: 'plugins/consensus/skills/consensus-refine/scripts/install-paseo.mjs'
});

function requireValue(argv, index, flag) {
  if (index + 1 >= argv.length) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index + 1];
}

function parsePositiveInteger(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== String(value) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function parsePeers(value) {
  const peers = String(value)
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean);

  if (peers.length !== 2) {
    throw new Error('--peers must contain exactly two peers');
  }

  return peers;
}

function normalizeProviderInventory(providerInventory) {
  const entries = Array.isArray(providerInventory)
    ? providerInventory
    : providerInventory?.providers ?? providerInventory?.data ?? [];

  return entries.map((entry) => {
    if (typeof entry === 'string') {
      return { id: entry, available: true };
    }

    const id = entry.id ?? entry.name ?? entry.provider;
    const available = entry.available === false || entry.enabled === false ? false : true;
    return { ...entry, id, available };
  });
}

function parseVersionText(text) {
  const match = String(text).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`could not parse paseo version from: ${String(text).trim()}`);
  }
  return match[0];
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

function missingPaseoError(cause) {
  const error = new Error(
    `paseo appears to be missing or unavailable. Install with "${PASEO_REMEDIATION.install_command}", build from ${PASEO_REMEDIATION.source_url}, or run ${PASEO_REMEDIATION.install_script}.`
  );
  error.code = 'PASEO_MISSING';
  error.cause = cause;
  error.remediation = PASEO_REMEDIATION;
  return error;
}

async function defaultRunCommand(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 2 * 1024 * 1024
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

export function parseWrapperArgs(argv) {
  const parsed = {
    mode: 'sequential',
    inputPath: null,
    goal: '',
    peers: null,
    maxRounds: 12,
    agency: 'moderate',
    output: null,
    resume: null,
    runDir: null,
    allowRoot: null,
    failOnSectionError: false,
    skipCorruptSections: [],
    yesSkipCorrupt: false,
    prepareParallel: false,
    parallelism: null,
    fanIn: false,
    manifestPath: null
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--goal':
        parsed.goal = requireValue(argv, index, token);
        index += 1;
        break;
      case '--peers':
        parsed.peers = parsePeers(requireValue(argv, index, token));
        index += 1;
        break;
      case '--max-rounds':
        parsed.maxRounds = parsePositiveInteger(
          requireValue(argv, index, token),
          '--max-rounds',
          MAX_ROUNDS_MIN,
          MAX_ROUNDS_MAX
        );
        index += 1;
        break;
      case '--agency':
        parsed.agency = requireValue(argv, index, token);
        index += 1;
        break;
      case '--output':
        parsed.output = requireValue(argv, index, token);
        index += 1;
        break;
      case '--resume':
        parsed.resume = requireValue(argv, index, token);
        index += 1;
        break;
      case '--run-dir':
        parsed.runDir = requireValue(argv, index, token);
        index += 1;
        break;
      case '--allow-root':
        parsed.allowRoot = requireValue(argv, index, token);
        index += 1;
        break;
      case '--fail-on-section-error':
        parsed.failOnSectionError = true;
        break;
      case '--skip-corrupt-section':
        parsed.skipCorruptSections.push(requireValue(argv, index, token));
        index += 1;
        break;
      case '--yes-skip-corrupt':
        parsed.yesSkipCorrupt = true;
        break;
      case '--prepare-parallel':
        parsed.prepareParallel = true;
        parsed.mode = 'prepare_parallel';
        break;
      case '--parallelism':
        parsed.parallelism = parsePositiveInteger(requireValue(argv, index, token), '--parallelism', 1, 64);
        index += 1;
        break;
      case '--fan-in':
        parsed.fanIn = true;
        parsed.mode = 'fan_in';
        parsed.manifestPath = requireValue(argv, index, token);
        index += 1;
        break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
    }
  }

  if (!['minimal', 'moderate', 'maximum'].includes(parsed.agency)) {
    throw new Error('--agency must be minimal, moderate, or maximum');
  }

  if (parsed.fanIn) {
    if (positionals.length > 0) {
      throw new Error('--fan-in does not accept an input path');
    }
    return parsed;
  }

  if (positionals.length > 1) {
    throw new Error(`unexpected positional argument: ${positionals[1]}`);
  }

  parsed.inputPath = positionals[0] ?? null;
  if (!parsed.inputPath) {
    throw new Error('input path is required');
  }

  return parsed;
}

export function detectHost(env = process.env) {
  if (env.CLAUDECODE || env.CLAUDE_CODE || env.CLAUDECODE_SESSION_ID) {
    return 'claude';
  }
  if (Object.keys(env).some((key) => key.startsWith('CODEX_'))) {
    return 'codex';
  }
  if (Object.keys(env).some((key) => key.startsWith('CURSOR_'))) {
    return 'cursor';
  }
  return 'unknown';
}

export function resolvePeers(options = {}, host = 'unknown', providerInventory = []) {
  const defaultPeers = host === 'codex' ? ['codex', 'claude'] : ['claude', 'codex'];
  const peers = options.peers ?? defaultPeers;
  const inventory = normalizeProviderInventory(providerInventory);
  const byId = new Map(inventory.map((entry) => [entry.id, entry]));
  const missing = [];
  const unavailable = [];

  for (const peer of peers) {
    const entry = byId.get(peer);
    if (!entry) {
      missing.push(peer);
    } else if (entry.available === false) {
      unavailable.push(peer);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing peers in Paseo inventory: ${missing.join(', ')}. Verify configured providers with "paseo provider ls --json".`
    );
  }

  if (unavailable.length > 0) {
    throw new Error(`Paseo providers are unavailable: ${unavailable.join(', ')}.`);
  }

  return { peers, inventory };
}

export async function preflightPaseo(options = {}) {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  let versionOutput;
  let inventoryOutput;
  try {
    versionOutput = await runCommand('paseo', ['--version'], { env, cwd });
    inventoryOutput = await runCommand('paseo', ['provider', 'ls', '--json'], { env, cwd });
  } catch (error) {
    if (error.code === 'ENOENT' || /ENOENT|not found/i.test(error.message)) {
      throw missingPaseoError(error);
    }
    throw error;
  }

  const version = parseVersionText(versionOutput.stdout);
  let providerInventory;
  try {
    providerInventory = JSON.parse(inventoryOutput.stdout);
  } catch (error) {
    throw new Error(`paseo provider inventory was not valid JSON: ${error.message}`);
  }

  const host = detectHost(env);
  const resolved = resolvePeers(options, host, providerInventory);
  const warnings = [];
  if (compareVersions(version, MIN_PASEO_VERSION) < 0 || compareVersions(version, MAX_TESTED_PASEO_VERSION) > 0) {
    warnings.push({
      code: 'PASEO_VERSION_UNTESTED',
      level: 'warning',
      version,
      min: MIN_PASEO_VERSION,
      max: MAX_TESTED_PASEO_VERSION,
      message: `Paseo ${version} is outside the tested range ${MIN_PASEO_VERSION} to ${MAX_TESTED_PASEO_VERSION}.`
    });
  }

  return {
    ok: true,
    version,
    providerInventory: normalizeProviderInventory(providerInventory),
    peers: resolved.peers,
    warnings
  };
}
