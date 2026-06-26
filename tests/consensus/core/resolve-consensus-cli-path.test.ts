import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  consensusSharedCliPath,
  providerCliSpawnTarget,
  resolveConsensusCliPath,
  resolveConsensusCliPathDetails,
} from '../../../src/consensus/core/consensus-loop.js';

function scrubbedEnv(home: string): NodeJS.ProcessEnv {
  return {
    HOME: home,
    PATH: process.env.PATH,
  };
}

async function writeExecutableStub(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, '#!/usr/bin/env node\n');
}

describe('resolveConsensusCliPath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the explicit argument before env, plugin, or shared fallbacks', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-resolve-explicit-'),
    );
    try {
      const home = path.join(tempRoot, 'home');
      vi.stubEnv('HOME', home);
      const explicit = path.join(tempRoot, 'bin', 'consensus-explicit');
      const envPath = path.join(tempRoot, 'bin', 'consensus-env');
      const pluginPath = path.join(tempRoot, 'plugin', 'scripts', 'consensus.mjs');
      await writeExecutableStub(pluginPath);

      expect(
        resolveConsensusCliPath({
          consensusCliPath: explicit,
          env: { ...scrubbedEnv(home), CONSENSUS_CLI_PATH: envPath },
          defaultCliPath: pluginPath,
        }),
      ).toBe(explicit);
      expect(
        resolveConsensusCliPathDetails({
          consensusCliPath: explicit,
          env: { ...scrubbedEnv(home), CONSENSUS_CLI_PATH: envPath },
          defaultCliPath: pluginPath,
        }),
      ).toMatchObject({
        status: 'resolved',
        source: 'explicit',
        path: explicit,
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses CONSENSUS_CLI_PATH before plugin or shared fallbacks', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-resolve-env-'),
    );
    try {
      const home = path.join(tempRoot, 'home');
      vi.stubEnv('HOME', home);
      const envPath = path.join(tempRoot, 'bin', 'consensus-env');
      const pluginPath = path.join(tempRoot, 'plugin', 'scripts', 'consensus.mjs');
      await writeExecutableStub(pluginPath);

      expect(
        resolveConsensusCliPath({
          env: { ...scrubbedEnv(home), CONSENSUS_CLI_PATH: envPath },
          defaultCliPath: pluginPath,
        }),
      ).toBe(envPath);
      expect(
        resolveConsensusCliPathDetails({
          env: { ...scrubbedEnv(home), CONSENSUS_CLI_PATH: envPath },
          defaultCliPath: pluginPath,
        }),
      ).toMatchObject({
        status: 'resolved',
        source: 'env',
        path: envPath,
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses the plugin-relative CLI when it exists', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-resolve-plugin-'),
    );
    try {
      const home = path.join(tempRoot, 'home');
      vi.stubEnv('HOME', home);
      const pluginPath = path.join(tempRoot, 'plugin', 'scripts', 'consensus.mjs');
      await writeExecutableStub(pluginPath);

      expect(
        resolveConsensusCliPath({
          env: scrubbedEnv(home),
          defaultCliPath: pluginPath,
        }),
      ).toBe(pluginPath);
      expect(
        resolveConsensusCliPathDetails({
          env: scrubbedEnv(home),
          defaultCliPath: pluginPath,
        }),
      ).toMatchObject({
        status: 'resolved',
        source: 'plugin',
        path: pluginPath,
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses ~/.consensus/consensus.mjs when plugin-relative CLI is absent', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-resolve-shared-'),
    );
    try {
      const home = path.join(tempRoot, 'home');
      vi.stubEnv('HOME', home);
      const pluginPath = path.join(tempRoot, 'missing', 'consensus.mjs');
      const sharedPath = path.join(home, '.consensus', 'consensus.mjs');
      await writeExecutableStub(sharedPath);

      expect(consensusSharedCliPath(home)).toBe(sharedPath);
      expect(
        resolveConsensusCliPath({
          env: scrubbedEnv(home),
          defaultCliPath: pluginPath,
        }),
      ).toBe(sharedPath);
      expect(
        resolveConsensusCliPathDetails({
          env: scrubbedEnv(home),
          defaultCliPath: pluginPath,
        }),
      ).toMatchObject({
        status: 'resolved',
        source: 'shared-home',
        path: sharedPath,
      });
      expect(providerCliSpawnTarget(sharedPath, ['provider', 'ls'])).toEqual({
        command: process.execPath,
        args: [sharedPath, 'provider', 'ls'],
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('reports missing when neither plugin-relative nor shared-home CLI exists', async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), 'consensus-resolve-missing-'),
    );
    try {
      const home = path.join(tempRoot, 'home');
      vi.stubEnv('HOME', home);
      const pluginPath = path.join(tempRoot, 'missing', 'consensus.mjs');
      const sharedPath = path.join(home, '.consensus', 'consensus.mjs');

      expect(
        resolveConsensusCliPathDetails({
          env: scrubbedEnv(home),
          defaultCliPath: pluginPath,
        }),
      ).toEqual({
        status: 'missing',
        attemptedPaths: [pluginPath, sharedPath],
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
