import { describe, expect, it } from 'vitest';

import { denyPermissionRequest } from './responder.js';

const toolCall = {
  toolCallId: 'call-7',
  name: 'write_file',
  title: 'File notes.txt',
  kind: 'edit',
  rawInput: { Content: 'secret text' },
  content: [{ type: 'diff', path: '/repo/notes.txt', newText: 'secret text' }],
  locations: [{ path: '/repo/notes.txt' }],
};

describe('denyPermissionRequest', () => {
  it('falls back to reject_always by kind when no reject_once option exists', () => {
    const { response } = denyPermissionRequest({
      toolCall,
      options: [
        { optionId: 'a', kind: 'allow_always' },
        { optionId: 'z', kind: 'reject_always' },
        { optionId: 'b', kind: 'allow_once' },
      ],
    });

    expect(response).toEqual({
      outcome: { outcome: 'selected', optionId: 'z' },
    });
  });

  it('answers cancelled when no reject option is offered, never an allow option', () => {
    const { response, denial } = denyPermissionRequest({
      toolCall,
      options: [
        { optionId: 'deny', name: 'Deny', kind: 'allow_once' },
        { optionId: 'cancel', kind: 'allow_always' },
      ],
    });

    expect(response).toEqual({ outcome: { outcome: 'cancelled' } });
    expect(denial.outcome).toBe('cancelled');
  });

  it('answers cancelled once the turn is being cancelled', () => {
    const { response } = denyPermissionRequest(
      { toolCall, options: [{ optionId: 'no', kind: 'reject_once' }] },
      { cancelled: true },
    );

    expect(response).toEqual({ outcome: { outcome: 'cancelled' } });
  });

  it('records only identifying fields, never input, content or paths', () => {
    const { denial } = denyPermissionRequest({
      toolCall,
      options: [{ optionId: 'no', kind: 'reject_once' }],
    });

    expect(denial).toEqual({
      tool_call_id: 'call-7',
      tool: 'write_file',
      kind: 'edit',
      outcome: 'rejected',
    });
  });
});
