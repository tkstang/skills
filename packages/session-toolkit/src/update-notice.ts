import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

interface InteractiveOperation {
  argv: readonly string[];
  stdinTTY: boolean;
  stderrTTY: boolean;
  env: Readonly<Record<string, string | undefined>>;
  home: string;
  version: string;
  stderr(text: string): void;
}
const TTL = 24 * 60 * 60 * 1000;
const REGISTRY = 'https://registry.npmjs.org/@tkstang%2fsession-toolkit/latest';
function stable(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)
  );
}
function newer(latest: string, current: string): boolean {
  if (!stable(current)) return false;
  const a = latest.split('.').map(BigInt),
    b = current.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
/** Called only by the CLI bin after a successful operation. Never imported by the library. */
export async function notifyUpdate(input: InteractiveOperation): Promise<void> {
  if (
    !input.stdinTTY ||
    !input.stderrTTY ||
    input.env.SESHTK_NO_UPDATE_CHECK === '1' ||
    input.env.CI ||
    input.argv.some((arg) =>
      ['--json', '--help', '-h', '--version', '-V'].includes(arg),
    ) ||
    ![
      'self-identify',
      'list',
      'read',
      'parse',
      'search',
      'export',
      'activity',
    ].includes(input.argv[0] ?? '')
  )
    return;
  try {
    const directory = join(
      input.env.XDG_CACHE_HOME || join(input.home, '.cache'),
      'session-toolkit',
    );
    const file = join(directory, 'update.json');
    const now = Date.now();
    let latest: string | null = null;
    let fresh = false;
    try {
      const cache: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (
        cache &&
        typeof cache === 'object' &&
        'checkedAt' in cache &&
        'latest' in cache &&
        typeof cache.checkedAt === 'number' &&
        Number.isFinite(cache.checkedAt) &&
        now >= cache.checkedAt &&
        now - cache.checkedAt < TTL &&
        (cache.latest === null || stable(cache.latest))
      ) {
        latest = cache.latest;
        fresh = true;
      }
    } catch {
      /* An absent or malformed cache triggers one best-effort lookup. */
    }
    if (!fresh) {
      try {
        const response = await fetch(REGISTRY, {
          signal: AbortSignal.timeout(1000),
          headers: { accept: 'application/json' },
        });
        if (response.ok) {
          const value: unknown = await response.json();
          if (
            value &&
            typeof value === 'object' &&
            'version' in value &&
            stable(value.version)
          )
            latest = value.version;
        }
      } catch {
        /* Offline, malformed and timed-out lookups never alter command success. */
      }
      const temporary = join(directory, `update-${randomUUID()}.tmp`);
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(
          temporary,
          JSON.stringify({ checkedAt: now, latest }) + '\n',
        );
        await rename(temporary, file);
      } catch {
        /* A cache write failure is equally non-fatal. */
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
    }
    if (latest && newer(latest, input.version))
      input.stderr(
        `Session Toolkit ${latest} is available (installed ${input.version}). Update with npm install -g @tkstang/session-toolkit@${latest}.\n`,
      );
  } catch {
    /* No updater failure may change an operation's result. */
  }
}
