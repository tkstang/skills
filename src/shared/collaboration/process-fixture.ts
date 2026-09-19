import { once } from 'node:events';

import { sendMessage, type SendMessageInput } from './messages.js';
import { publishImmutableRecord, type PublicationHooks } from './records.js';

async function barrier(): Promise<void> {
  process.stdout.write('ready\n');
  await once(process.stdin, 'data');
}

async function main(): Promise<void> {
  const [mode, payload] = process.argv.slice(2);
  if (!payload) throw new Error('fixture payload is required');
  const input = JSON.parse(payload) as Record<string, unknown>;
  if (mode === 'publish') {
    const stage = String(input.stage) as keyof PublicationHooks;
    const hooks: PublicationHooks = { [stage]: barrier };
    const result = await publishImmutableRecord(
      String(input.target),
      {
        schemaVersion: 1,
        id: String(input.id),
      },
      { root: String(input.root), hooks },
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (mode === 'send') {
    await barrier();
    const result = await sendMessage(input as unknown as SendMessageInput);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  throw new Error(`unknown fixture mode: ${String(mode)}`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
