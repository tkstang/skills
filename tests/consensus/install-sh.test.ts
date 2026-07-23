import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { resolveConsensusCliPath } from '../../src/consensus/core/consensus-loop.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const installScript = path.join(repoRoot, 'install.sh');
const checkoutConsensusScript = path.join(
  repoRoot,
  'plugins',
  'consensus',
  'scripts',
  'consensus.mjs',
);

function installEnv(home: string, extra: NodeJS.ProcessEnv = {}) {
  return {
    HOME: home,
    PATH: process.env.PATH,
    ...extra,
  };
}

async function runInstall(home: string, extraEnv: NodeJS.ProcessEnv = {}) {
  return execFileAsync('bash', [installScript], {
    cwd: repoRoot,
    env: installEnv(home, extraEnv),
  });
}

function installedConsensusPath(home: string) {
  return path.join(home, '.consensus', 'consensus.mjs');
}

async function pathExists(target: string) {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}

describe('install.sh', () => {
  describe('CONSENSUS_INSTALL_SHA256 checksum verification', () => {
    it('unset: behavior is unchanged on the local-checkout path', async () => {
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-install-checksum-unset-'),
      );
      try {
        const home = path.join(tempRoot, 'home');
        await mkdir(home, { recursive: true });

        await runInstall(home);

        expect(await readFile(installedConsensusPath(home), 'utf8')).toBe(
          await readFile(checkoutConsensusScript, 'utf8'),
        );
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    });

    it('right hash: succeeds on the local-checkout path', async () => {
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-install-checksum-ok-'),
      );
      try {
        const home = path.join(tempRoot, 'home');
        await mkdir(home, { recursive: true });
        const expectedHash = createHash('sha256')
          .update(await readFile(checkoutConsensusScript))
          .digest('hex');

        await runInstall(home, { CONSENSUS_INSTALL_SHA256: expectedHash });

        expect(await readFile(installedConsensusPath(home), 'utf8')).toBe(
          await readFile(checkoutConsensusScript, 'utf8'),
        );
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    });

    it('wrong hash: fails on the local-checkout path and installs nothing', async () => {
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-install-checksum-bad-'),
      );
      try {
        const home = path.join(tempRoot, 'home');
        await mkdir(home, { recursive: true });

        await expect(
          runInstall(home, {
            CONSENSUS_INSTALL_SHA256:
              'deadbeef00000000000000000000000000000000000000000000000000000000',
          }),
        ).rejects.toMatchObject({
          stderr: expect.stringContaining('checksum mismatch'),
        });

        expect(await pathExists(installedConsensusPath(home))).toBe(false);
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    });

    it('wrong hash: fails on the remote-fetch path and leaves an existing target unchanged', async () => {
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), 'consensus-install-checksum-remote-bad-'),
      );
      try {
        const home = path.join(tempRoot, 'home');
        const binDir = path.join(tempRoot, 'bin');
        await mkdir(home, { recursive: true });
        await mkdir(binDir, { recursive: true });

        const curlPath = path.join(binDir, 'curl');
        await writeFile(
          curlPath,
          [
            '#!/usr/bin/env bash',
            'printf "%s\\n" "#!/usr/bin/env node"',
            'printf "%s\\n" "console.log(\\"remote consensus\\");"',
            '',
          ].join('\n'),
        );
        await chmod(curlPath, 0o755);

        // Pre-populate the install target so we can assert a checksum
        // mismatch never overwrites an existing installation.
        const installedPath = installedConsensusPath(home);
        await mkdir(path.dirname(installedPath), { recursive: true });
        await writeFile(installedPath, 'previously installed content\n');

        await expect(
          runInstall(home, {
            CONSENSUS_INSTALL_FORCE_REMOTE: '1',
            CONSENSUS_INSTALL_RAW_BASE: 'https://example.test/tkstang/skills/v-test',
            CONSENSUS_INSTALL_SHA256:
              'deadbeef00000000000000000000000000000000000000000000000000000000',
            PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
          }),
        ).rejects.toMatchObject({
          stderr: expect.stringContaining('checksum mismatch'),
        });

        expect(await readFile(installedPath, 'utf8')).toBe(
          'previously installed content\n',
        );
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    });
  });
  it('copies the in-checkout consensus CLI into ~/.consensus and is idempotent', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-install-'));
    try {
      const home = path.join(tempRoot, 'home');
      await mkdir(home, { recursive: true });

      await runInstall(home);
      const installedPath = installedConsensusPath(home);
      expect(await readFile(installedPath, 'utf8')).toBe(
        await readFile(checkoutConsensusScript, 'utf8'),
      );
      expect(
        resolveConsensusCliPath({
          env: installEnv(home),
          defaultCliPath: path.join(tempRoot, 'missing-plugin', 'consensus.mjs'),
        }),
      ).toBe(installedPath);

      await runInstall(home);
      expect(await readFile(installedPath, 'utf8')).toBe(
        await readFile(checkoutConsensusScript, 'utf8'),
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails clearly when the target directory cannot be created', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'consensus-install-fail-'));
    try {
      const home = path.join(tempRoot, 'home');
      await mkdir(home, { recursive: true });
      await writeFile(path.join(home, '.consensus'), 'not a directory\n');

      await expect(runInstall(home)).rejects.toMatchObject({
        stderr: expect.stringContaining('failed to create'),
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('can fetch the pinned remote source through a mocked curl path', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-install-remote-'),
    );
    try {
      const home = path.join(tempRoot, 'home');
      const binDir = path.join(tempRoot, 'bin');
      const logPath = path.join(tempRoot, 'curl.log');
      await mkdir(binDir, { recursive: true });
      const curlPath = path.join(binDir, 'curl');
      await writeFile(
        curlPath,
        [
          '#!/usr/bin/env bash',
          'printf "%s\\n" "$*" >> "$CONSENSUS_CURL_LOG"',
          'printf "%s\\n" "#!/usr/bin/env node"',
          'printf "%s\\n" "console.log(\\"remote consensus\\");"',
          '',
        ].join('\n'),
      );
      await chmod(curlPath, 0o755);

      await runInstall(home, {
        CONSENSUS_INSTALL_FORCE_REMOTE: '1',
        CONSENSUS_INSTALL_RAW_BASE: 'https://example.test/tkstang/skills/v-test',
        CONSENSUS_CURL_LOG: logPath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      });

      expect(await readFile(installedConsensusPath(home), 'utf8')).toContain(
        'remote consensus',
      );
      expect(await readFile(logPath, 'utf8')).toContain(
        'https://example.test/tkstang/skills/v-test/plugins/consensus/scripts/consensus.mjs',
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
