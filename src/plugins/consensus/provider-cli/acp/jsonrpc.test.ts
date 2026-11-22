import { describe, expect, it } from 'vitest';

import type { IncomingRequest } from './jsonrpc.js';
import { JsonRpcConnection } from './jsonrpc.js';

function connection() {
  const written: Record<string, unknown>[] = [];
  const requests: IncomingRequest[] = [];
  const notifications: string[] = [];
  const rpc = new JsonRpcConnection({
    write: (line) => written.push(JSON.parse(line)),
    onRequest: (request) => {
      requests.push(request);
      return { result: { answered: request.method } };
    },
    onNotification: (method) => notifications.push(method),
  });
  return { rpc, written, requests, notifications };
}

describe('JsonRpcConnection', () => {
  it('keeps the agent id space apart from ours when ids collide', async () => {
    const { rpc, written, requests } = connection();
    const ours = rpc.request('session/prompt', {});
    expect(ours.id).toBe(1);

    // The agent's own request with id 1 (and a string "1") is a request to
    // answer, not the response to ours.
    rpc.receiveLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'session/request_permission',
      }),
    );
    rpc.receiveLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'session/request_permission',
      }),
    );
    // A response carrying the string id "1" does not settle our numeric 1.
    rpc.receiveLine(JSON.stringify({ jsonrpc: '2.0', id: '1', result: {} }));
    rpc.receiveLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { stopReason: 'end_turn' },
      }),
    );

    await expect(ours.outcome).resolves.toEqual({
      kind: 'result',
      result: { stopReason: 'end_turn' },
    });
    expect(requests.map((request) => request.id)).toEqual([1, '1']);
    expect(written.slice(1)).toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        result: { answered: 'session/request_permission' },
      },
      {
        jsonrpc: '2.0',
        id: '1',
        result: { answered: 'session/request_permission' },
      },
    ]);
    expect(rpc.stats().unmatched_responses).toBe(1);
  });

  it('treats a method without an id as a notification and skips non-JSON lines', () => {
    const { rpc, requests, notifications } = connection();

    rpc.receiveLine('Loaded cached credentials.');
    rpc.receiveLine(
      JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: {} }),
    );

    expect(notifications).toEqual(['session/update']);
    expect(requests).toEqual([]);
    expect(rpc.stats().ignored_lines).toBe(1);
  });

  it('settles pending and later requests as closed once the connection closes', async () => {
    const { rpc } = connection();
    const pending = rpc.request('initialize', {});

    rpc.close();

    await expect(pending.outcome).resolves.toEqual({ kind: 'closed' });
    await expect(rpc.request('session/new', {}).outcome).resolves.toEqual({
      kind: 'closed',
    });
  });
});
