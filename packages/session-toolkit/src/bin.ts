#!/usr/bin/env node
import { homedir } from 'node:os';

import { getCapabilities } from './capabilities.js';
import { main } from './cli.js';
import { notifyUpdate } from './update-notice.js';

process.exitCode = await main(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
});

if (process.exitCode === 0)
  await notifyUpdate({
    argv: process.argv.slice(2),
    stdinTTY: process.stdin.isTTY === true,
    stderrTTY: process.stderr.isTTY === true,
    env: process.env,
    home: homedir(),
    version: getCapabilities().version,
    stderr: (text) => {
      process.stderr.write(text);
    },
  });
