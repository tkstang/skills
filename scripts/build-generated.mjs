#!/usr/bin/env node

import { tsImport } from 'tsx/esm/api';

const implementation = await tsImport('./build-generated.ts', import.meta.url);

export const GENERATED_BANNER_PREFIX = implementation.GENERATED_BANNER_PREFIX;
export const generatedOutputs = implementation.generatedOutputs;
export const rewriteImportSpecifiers = implementation.rewriteImportSpecifiers;
export const collectRelativeModuleSpecifiers =
  implementation.collectRelativeModuleSpecifiers;
export const deriveImportRewrites = implementation.deriveImportRewrites;

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  await implementation.runBuildGenerated(process.argv.slice(2));
}
