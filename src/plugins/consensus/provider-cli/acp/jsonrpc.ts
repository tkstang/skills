// Newline-delimited JSON-RPC 2.0 connection for ACP over stdio. Our requests
// use numeric ids from 1; the agent's requests use their own id space and
// may be strings ("1") or numbers starting at 0, so incoming requests and
// incoming responses are told apart by shape, never by id value.

export type JsonRpcId = string | number;

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcOutcome =
  | { kind: 'result'; result: unknown }
  | { kind: 'error'; error: JsonRpcErrorObject }
  // The connection closed (the agent exited or stdout ended) first.
  | { kind: 'closed' };

export interface IncomingRequest {
  id: JsonRpcId;
  method: string;
  params: unknown;
}

export type JsonRpcReply = { result: unknown } | { error: JsonRpcErrorObject };

export interface JsonRpcConnectionOptions {
  write: (line: string) => void;
  // Answers an agent->client request. Replies are synchronous: the client
  // grants nothing that would need to wait on another party.
  onRequest: (request: IncomingRequest) => JsonRpcReply;
  onNotification: (method: string, params: unknown) => void;
}

export interface JsonRpcStats {
  // stdout lines that were not JSON-RPC messages.
  ignored_lines: number;
  // Responses whose id matched no request of ours.
  unmatched_responses: number;
}

export class JsonRpcConnection {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    (outcome: JsonRpcOutcome) => void
  >();
  private closed = false;
  private readonly counters: JsonRpcStats = {
    ignored_lines: 0,
    unmatched_responses: 0,
  };

  constructor(private readonly options: JsonRpcConnectionOptions) {}

  request(
    method: string,
    params: unknown,
  ): { id: number; outcome: Promise<JsonRpcOutcome> } {
    const id = this.nextId++;
    if (this.closed) {
      return { id, outcome: Promise.resolve({ kind: 'closed' }) };
    }
    const outcome = new Promise<JsonRpcOutcome>((resolve) => {
      this.pending.set(id, resolve);
    });
    this.send({ jsonrpc: '2.0', id, method, params });
    return { id, outcome };
  }

  notify(method: string, params: unknown) {
    if (this.closed) return;
    this.send({ jsonrpc: '2.0', method, params });
  }

  receiveLine(line: string) {
    if (line.trim() === '') return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.counters.ignored_lines++;
      return;
    }
    if (!isRecord(message)) {
      this.counters.ignored_lines++;
      return;
    }
    if (typeof message.method === 'string') {
      if (isJsonRpcId(message.id)) {
        this.answer(message.id, message.method, message.params);
      } else {
        this.options.onNotification(message.method, message.params);
      }
      return;
    }
    if ('result' in message || 'error' in message) {
      this.settleResponse(message);
      return;
    }
    this.counters.ignored_lines++;
  }

  // Settles every pending request as closed; later sends are dropped.
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.pending.values()) resolve({ kind: 'closed' });
    this.pending.clear();
  }

  isClosed() {
    return this.closed;
  }

  stats(): JsonRpcStats {
    return { ...this.counters };
  }

  private answer(id: JsonRpcId, method: string, params: unknown) {
    const reply = this.options.onRequest({ id, method, params });
    if (this.closed) return;
    this.send({ jsonrpc: '2.0', id, ...reply });
  }

  private settleResponse(message: Record<string, unknown>) {
    const id = message.id;
    const resolve = typeof id === 'number' ? this.pending.get(id) : undefined;
    if (!resolve || typeof id !== 'number') {
      this.counters.unmatched_responses++;
      return;
    }
    this.pending.delete(id);
    if ('error' in message) {
      resolve({ kind: 'error', error: toErrorObject(message.error) });
      return;
    }
    resolve({ kind: 'result', result: message.result });
  }

  private send(message: Record<string, unknown>) {
    this.options.write(`${JSON.stringify(message)}\n`);
  }
}

function toErrorObject(value: unknown): JsonRpcErrorObject {
  if (!isRecord(value)) {
    return { code: -32603, message: 'Malformed JSON-RPC error object' };
  }
  return {
    code: typeof value.code === 'number' ? value.code : -32603,
    message: typeof value.message === 'string' ? value.message : '',
    ...(value.data !== undefined ? { data: value.data } : {}),
  };
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || typeof value === 'number';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
