import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  byteLength,
  CONSENSUS_SUBMIT_CAPTURE_DIR,
  parseSubmitCaptureMaxBytes,
  submitCaptureDirectory,
  submitCaptureFilePath,
  submitCaptureMaxBytes,
  submitCaptureLimitMessage,
} from '../../../src/consensus/provider-cli/submit-capture.js';

describe('submit capture helpers', () => {
  it('resolves capture files under the provider cwd instead of the process tmpdir', () => {
    const cwd = path.join(path.sep, 'workspace', 'project');

    expect(submitCaptureDirectory(cwd)).toBe(
      path.join(cwd, '.consensus', 'submit'),
    );
    expect(submitCaptureFilePath(cwd, 'turn-123')).toBe(
      path.join(cwd, '.consensus', 'submit', 'consensus-submit-turn-123.json'),
    );
    expect(CONSENSUS_SUBMIT_CAPTURE_DIR).toBe('.consensus/submit');
  });

  it('keeps submit byte-limit parsing explicit', () => {
    expect(submitCaptureMaxBytes(undefined)).toBe(1024 * 1024 * 10);
    expect(submitCaptureMaxBytes(32)).toBe(32);
    expect(parseSubmitCaptureMaxBytes(undefined)).toBe(1024 * 1024 * 10);
    expect(parseSubmitCaptureMaxBytes('')).toBe(1024 * 1024 * 10);
    expect(parseSubmitCaptureMaxBytes('64')).toBe(64);
    expect(parseSubmitCaptureMaxBytes('0')).toBeUndefined();
    expect(parseSubmitCaptureMaxBytes('not-a-number')).toBeUndefined();
  });

  it('reports utf8 byte counts in limit messages', () => {
    expect(byteLength('é')).toBe(2);
    expect(submitCaptureLimitMessage(17, 16)).toBe(
      'Submitted verdict exceeds submit capture limit of 16 bytes (17 bytes).',
    );
  });
});
