import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

// Protects against native loaders losing imported tools/history across restart; byte-level importer tests cannot exercise provider persistence or request construction.
export const history = {
  prompt: 'SYNTHETIC_IMPORT_USER_71',
  answer: 'SYNTHETIC_IMPORT_ASSISTANT_72',
  callId: 'synthetic_call_73',
  tool: 'read_file',
  arguments: { path: 'synthetic_fixture.txt' },
  output: 'SYNTHETIC_IMPORT_TOOL_RESULT_74',
};
export const sourceId = '550e8400-e29b-41d4-a716-446655440073';
const sandbox = '/usr/bin/sandbox-exec';
type Json = Record<string, unknown>;

export class IsolationUnavailable extends Error {}

export function hash(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function executable(name: string): Promise<string> {
  // Resolve the binary only; do not inherit PATH or credentials into a client.
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, name);
    try {
      await access(candidate, 1);
      return await realpath(candidate);
    } catch {
      /* next */
    }
  }
  throw new IsolationUnavailable(`${name} executable unavailable`);
}

function kill(child: ChildProcessWithoutNullStreams): void {
  if (child.pid && child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

export interface Fixture {
  root: string;
  source: string;
  destination: string;
  home: string;
  targetHome: string;
  profile: string;
  client: string;
  env: NodeJS.ProcessEnv;
  cleanup(): Promise<void>;
}

export async function run(
  fixture: Fixture,
  argv: string[],
  timeout = 40_000,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(sandbox, ['-f', fixture.profile, ...argv], {
      cwd: fixture.destination,
      env: fixture.env,
      detached: true,
      stdio: 'pipe',
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      kill(child);
      reject(new Error(`Client timeout: ${argv[0]} ${argv[1] ?? ''}`));
    }, timeout);
    child.stdout.on('data', (bytes: Buffer) => {
      stdout += bytes.toString();
      if (stdout.length > 4 * 1024 * 1024) {
        kill(child);
        reject(new Error('Client output limit exceeded'));
      }
    });
    child.stderr.on('data', (bytes: Buffer) => {
      stderr = (stderr + bytes.toString()).slice(-16_384);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `Client exited ${code}${signal ? ` (${signal})` : ''}: ${stderr}\n${stdout.slice(-4_096)}`,
          ),
        );
    });
    child.stdin.end();
  });
}

export async function createFixture(
  provider: 'codex' | 'claude',
): Promise<Fixture> {
  if (process.platform !== 'darwin')
    throw new IsolationUnavailable(
      'Verified loopback sandbox requires macOS sandbox-exec',
    );
  try {
    await access(sandbox, 1);
  } catch {
    throw new IsolationUnavailable('sandbox-exec unavailable');
  }
  const client = await executable(provider);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'import-native-')));
  const source = join(root, 'source');
  const destination = join(root, 'destination with_spaces');
  const home = join(root, 'synthetic-home');
  const targetHome = join(root, 'target-home');
  const profile = join(root, 'loopback.sb');
  const privateBin = join(root, 'bin');
  const env: NodeJS.ProcessEnv = {
    HOME: home,
    USERPROFILE: home,
    STATE_DIR: join(root, 'state'),
    PATH: [
      privateBin,
      dirname(client),
      dirname(process.execPath),
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ].join(delimiter),
    TMPDIR: join(root, 'tmp'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    NO_COLOR: '1',
    TERM: 'xterm-256color',
    ...(provider === 'codex'
      ? { CODEX_HOME: targetHome, OPENAI_API_KEY: 'synthetic-loopback-only' }
      : {
          CLAUDE_CONFIG_DIR: targetHome,
          ANTHROPIC_API_KEY: 'synthetic-loopback-only',
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        }),
  };
  const result: Fixture = {
    root,
    source,
    destination,
    home,
    targetHome,
    profile,
    client,
    env,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
  try {
    for (const path of [source, home, targetHome, env.TMPDIR!, env.STATE_DIR!])
      await mkdir(path, { recursive: true });
    // Printed commands use the provider name; resolve it to this verified native binary even when its installed filename is a version number.
    await mkdir(privateBin);
    await symlink(client, join(privateBin, provider));
    await writeFile(
      profile,
      '(version 1)\n(allow default)\n(deny network-outbound)\n(allow network-outbound (remote ip "localhost:*"))\n',
    );
    // Git commands run with the same allowlist; no personal hooks or configuration.
    env.GIT_CONFIG_NOSYSTEM = '1';
    env.GIT_CONFIG_GLOBAL = '/dev/null';
    await mkdir(destination);
    const git = await executable('git');
    await run(result, [git, '-C', source, 'init', '-q']);
    await run(result, [
      git,
      '-C',
      source,
      '-c',
      'user.name=Synthetic',
      '-c',
      'user.email=synthetic@example.invalid',
      'commit',
      '--allow-empty',
      '-qm',
      'synthetic',
    ]);
    await run(result, [
      git,
      '-C',
      source,
      'worktree',
      'add',
      '-qb',
      'synthetic-destination',
      destination,
    ]);
    await verifyIsolation(result);
    return result;
  } catch (error) {
    await result.cleanup();
    throw error;
  }
}

async function verifyIsolation(fixture: Fixture): Promise<void> {
  const server = createServer((_request, response) => {
    response.end('loopback-permitted');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Loopback server has no port');
  const code = `const net=require('node:net');const s=net.connect({host:process.argv[1],port:Number(process.argv[2])});s.setTimeout(2000);s.on('connect',()=>{console.log('connected');s.destroy()});s.on('error',e=>console.log(e.code));s.on('timeout',()=>{console.log('timeout');s.destroy()});`;
  try {
    const allowed = await run(
      fixture,
      [process.execPath, '-e', code, '127.0.0.1', String(address.port)],
      5_000,
    );
    const denied = await run(
      fixture,
      [process.execPath, '-e', code, '203.0.113.1', '443'],
      5_000,
    );
    if (
      allowed.trim() !== 'connected' ||
      !/^(EPERM|EACCES)$/u.test(denied.trim())
    ) {
      throw new IsolationUnavailable(
        `Network isolation unverified: loopback=${allowed.trim()}, external=${denied.trim()}`,
      );
    }
  } catch (error) {
    if (error instanceof IsolationUnavailable) throw error;
    throw new IsolationUnavailable(
      `Sandbox cannot be verified: ${String(error)}`,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

export async function sourceTranscript(
  fixture: Fixture,
  provider: 'codex' | 'claude',
): Promise<string> {
  const timestamp = '2026-09-30T12:00:00.000Z';
  let path: string;
  let rows: unknown[];
  if (provider === 'codex') {
    path = join(
      fixture.home,
      '.codex',
      'sessions',
      '2026',
      '09',
      '30',
      `rollout-2026-09-30T12-00-00-${sourceId}.jsonl`,
    );
    rows = [
      {
        type: 'session_meta',
        timestamp,
        payload: {
          id: sourceId,
          timestamp,
          cwd: fixture.source,
          originator: 'codex_cli_rs',
          cli_version: '0.157.1',
          source: 'cli',
          model_provider: 'openai',
        },
      },
      ...[
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: history.prompt }],
        },
        {
          type: 'function_call',
          call_id: history.callId,
          name: history.tool,
          arguments: JSON.stringify(history.arguments),
        },
        {
          type: 'function_call_output',
          call_id: history.callId,
          output: history.output,
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: history.answer }],
        },
      ].map((payload) => ({ type: 'response_item', timestamp, payload })),
    ];
  } else {
    path = join(
      fixture.home,
      '.claude',
      'projects',
      fixture.source.replace(/[^A-Za-z0-9]/gu, '-'),
      `${sourceId}.jsonl`,
    );
    const bodies = [
      { role: 'user', content: history.prompt },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: history.callId,
            name: history.tool,
            input: history.arguments,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: history.callId,
            content: history.output,
          },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: history.answer }] },
    ];
    rows = bodies.map((message, index) => ({
      type: message.role,
      uuid: `synthetic-row-${index}`,
      parentUuid: index ? `synthetic-row-${index - 1}` : null,
      sessionId: sourceId,
      cwd: fixture.source,
      timestamp,
      isSidechain: false,
      userType: 'external',
      version: '2.1.284',
      message: {
        ...message,
        ...(message.role === 'assistant'
          ? {
              id: `synthetic-message-${index}`,
              type: 'message',
              model: 'synthetic',
              stop_reason: index === 1 ? 'tool_use' : 'end_turn',
              usage: { input_tokens: 1, output_tokens: 1 },
            }
          : {}),
      },
    }));
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    rows.map((row) => JSON.stringify(row)).join('\n') + '\n',
  );
  return path;
}

function events(
  provider: 'codex' | 'claude',
  text: string,
  sequence: number,
): Json[] {
  if (provider === 'claude')
    return [
      {
        type: 'message_start',
        message: {
          id: `msg_${sequence}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 20, output_tokens: 0 },
        },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 5 },
      },
      { type: 'message_stop' },
    ];
  const part = { type: 'output_text', text, annotations: [] };
  const item = {
    id: `msg_${sequence}`,
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [part],
  };
  const response = {
    id: `resp_${sequence}`,
    object: 'response',
    created_at: 1,
    status: 'completed',
    model: 'probe-model',
    output: [item],
    usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
  };
  return [
    {
      type: 'response.created',
      response: { ...response, status: 'in_progress', output: [] },
    },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { ...item, status: 'in_progress', content: [] },
    },
    {
      type: 'response.content_part.added',
      output_index: 0,
      item_id: item.id,
      content_index: 0,
      part: { ...part, text: '' },
    },
    {
      type: 'response.output_text.delta',
      output_index: 0,
      item_id: item.id,
      content_index: 0,
      delta: text,
    },
    {
      type: 'response.output_text.done',
      output_index: 0,
      item_id: item.id,
      content_index: 0,
      text,
    },
    {
      type: 'response.content_part.done',
      output_index: 0,
      item_id: item.id,
      content_index: 0,
      part,
    },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response },
  ];
}

class Queue<T> {
  private values: T[] = [];
  private waiting: Array<(value: T) => void> = [];
  push(value: T): void {
    const waiter = this.waiting.shift();
    if (waiter) waiter(value);
    else this.values.push(value);
  }
  async next(timeout = 40_000): Promise<T> {
    if (this.values.length) return this.values.shift()!;
    return await new Promise<T>((resolve, reject) => {
      const handler = (value: T) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter((item) => item !== handler);
        reject(new Error('Native client event timeout'));
      }, timeout);
      this.waiting.push(handler);
    });
  }
}

export async function api(provider: 'codex' | 'claude', replies: string[]) {
  const requests = new Queue<Json>();
  let sequence = 0;
  const server = createServer(async (request, response) => {
    try {
      let raw = '';
      for await (const chunk of request) {
        raw += String(chunk);
        if (raw.length > 4 * 1024 * 1024)
          throw new Error('Request limit exceeded');
      }
      const body = JSON.parse(raw) as Json;
      if (request.url?.includes('count_tokens')) {
        response.setHeader('content-type', 'application/json');
        response.end('{"input_tokens":10}');
        return;
      }
      requests.push(body);
      const reply = replies[sequence++];
      if (!reply) throw new Error('Unexpected extra model request');
      const stream = events(provider, reply, sequence)
        .map(
          (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        )
        .join('');
      response.setHeader('content-type', 'text/event-stream');
      response.end(stream);
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing loopback address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    next: () => requests.next(),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

export function codexConfig(url: string, destination: string): string {
  return `model_provider = "probe"\nmodel = "probe-model"\n[model_providers.probe]\nname = "Loopback synthetic probe"\nbase_url = ${JSON.stringify(url)}\nwire_api = "responses"\nsupports_websockets = false\n[projects.${JSON.stringify(destination)}]\ntrust_level = "trusted"\n`;
}

export async function app(fixture: Fixture) {
  const processChild = spawn(
    sandbox,
    [
      '-f',
      fixture.profile,
      fixture.client,
      'app-server',
      '--listen',
      'stdio://',
    ],
    {
      cwd: fixture.destination,
      env: fixture.env,
      detached: true,
      stdio: 'pipe',
    },
  );
  const responses = new Queue<Json>();
  const notes = new Queue<Json>();
  let sequence = 0;
  let stderr = '';
  processChild.stderr.on('data', (bytes: Buffer) => {
    stderr = (stderr + bytes.toString()).slice(-16_384);
  });
  const reader = createInterface({ input: processChild.stdout });
  reader.on('line', (line) => {
    try {
      const value = JSON.parse(line) as Json;
      ('id' in value ? responses : notes).push(value);
    } catch {
      /* non-protocol output */
    }
  });
  const rpc = async (method: string, params: Json): Promise<Json> => {
    const id = ++sequence;
    processChild.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    try {
      for (;;) {
        const response = await responses.next();
        if (response.id !== id) continue;
        if ('error' in response)
          throw new Error(`${method}: ${JSON.stringify(response.error)}`);
        return response.result as Json;
      }
    } catch (error) {
      throw new Error(`${String(error)}\n${stderr}`, { cause: error });
    }
  };
  const close = async () => {
    reader.close();
    kill(processChild);
    await new Promise<void>((resolve) => {
      if (processChild.exitCode !== null) resolve();
      else processChild.once('close', () => resolve());
    });
  };
  try {
    await rpc('initialize', {
      clientInfo: { name: 'import-native-client-test', version: '1.0' },
      capabilities: { experimentalApi: true },
    });
  } catch (error) {
    await close();
    throw error;
  }
  return {
    rpc,
    close,
    completed: async () => {
      for (;;) {
        const note = await notes.next();
        if (note.method === 'turn/completed')
          return (note.params as { turn: { status: string } }).turn.status;
      }
    },
  };
}

export async function transcriptBytes(path: string): Promise<Buffer> {
  return await readFile(path);
}

export async function printedCodexCreation(
  fixture: Fixture,
  command: string,
  parentId: string,
): Promise<string> {
  const script = '/usr/bin/script';
  try {
    await access(script, 1);
  } catch {
    return 'unverified: macOS script PTY unavailable';
  }
  const existing = new Set(
    await readdir(join(fixture.targetHome, 'sessions'), { recursive: true }),
  );
  // Execute the exact guarded command. No extra provider flags are appended.
  const child = spawn(
    sandbox,
    [
      '-f',
      fixture.profile,
      script,
      '-q',
      '/dev/null',
      '/bin/sh',
      '-c',
      command,
    ],
    {
      cwd: fixture.destination,
      env: fixture.env,
      detached: true,
      stdio: 'pipe',
    },
  );
  child.stdout.resume();
  child.stderr.resume();
  child.on('error', () => {});
  const deadline = Date.now() + 12_000;
  let found: { id: string; cwd: string } | undefined;
  let failure = 'no distinct child persisted within 12 seconds';
  try {
    while (Date.now() < deadline && child.exitCode === null) {
      for (const relative of await readdir(
        join(fixture.targetHome, 'sessions'),
        { recursive: true },
      )) {
        if (
          !relative.endsWith('.jsonl') ||
          existing.has(relative) ||
          relative.endsWith(`${parentId}.jsonl`)
        )
          continue;
        const text = await readFile(
          join(fixture.targetHome, 'sessions', relative),
          'utf8',
        );
        const header = text
          .split('\n')
          .find((line) => line.includes('session_meta'));
        if (!header) continue;
        const row = JSON.parse(header) as {
          payload: { id: string; cwd: string; forked_from_id?: string };
        };
        if (
          row.payload.forked_from_id === parentId &&
          row.payload.id !== parentId &&
          row.payload.cwd === fixture.destination
        ) {
          // Only count a child created by this exact-command run, not an earlier RPC child.
          found = row.payload;
          break;
        }
      }
      if (found) {
        child.stdin.write('/exit\r\r');
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
  } catch (error) {
    failure = String(error);
  } finally {
    kill(child);
    child.stdin.destroy();
  }
  return found
    ? `passed: exact printed command created native child ${found.id}; no terminal turn tested`
    : `unverified: ${failure}`;
}
