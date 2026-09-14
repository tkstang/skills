#!/usr/bin/env node

import { runGuidanceCli } from './guidance-cli.js';

process.exitCode = await runGuidanceCli(process.argv.slice(2));
