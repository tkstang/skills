import { randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';

import {
  isCollaborationClosed,
  MembershipError,
  resolveMemberByPin,
} from './membership.js';
import { collaborationPaths } from './paths.js';
import {
  canonicalHash,
  CollaborationError,
  enumerateJsonRecords,
  publishImmutableRecord,
  readJsonRecord,
} from './records.js';
import {
  assertBoundedString,
  assertPin,
  assertUuid,
  type LogEntryRecord,
  type CollaborationRecord,
  type Pin,
} from './types.js';

export interface AppendLogInput {
  root: string;
  collaborationId: string;
  pin: Pin;
  id: string;
  category: string;
  title: string;
  whatHappened: string;
  assessment: string;
  skillImplication: string;
  now?: string;
}

function timestamp(value?: string): string {
  const result = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(result)))
    throw new TypeError('timestamp must be ISO-8601');
  return result;
}

function entryContent(input: AppendLogInput): unknown {
  return {
    collaborationId: input.collaborationId,
    id: input.id,
    category: input.category,
    title: input.title,
    author: input.pin,
    whatHappened: input.whatHappened,
    assessment: input.assessment,
    skillImplication: input.skillImplication,
  };
}

export async function appendLogEntry(
  input: AppendLogInput,
): Promise<{ entry: LogEntryRecord; duplicate: boolean }> {
  assertUuid(input.collaborationId, 'collaboration ID');
  assertUuid(input.id, 'entry ID');
  assertPin(input.pin);
  assertBoundedString(input.category, 'category', 64);
  assertBoundedString(input.title, 'title', 256);
  assertBoundedString(input.whatHappened, 'what happened', 16 * 1024);
  assertBoundedString(input.assessment, 'assessment', 2048);
  assertBoundedString(input.skillImplication, 'skill implication', 4096);
  if (await isCollaborationClosed(input.root, input.collaborationId)) {
    throw new MembershipError(
      'COLLABORATION_CLOSED',
      'collaboration log is closed',
    );
  }
  const author = await resolveMemberByPin(
    input.root,
    input.collaborationId,
    input.pin,
  );
  if (author.departed) {
    throw new MembershipError(
      'MEMBER_DEPARTED',
      'departed member cannot append to the log',
    );
  }
  const contentHash = canonicalHash(entryContent(input));
  const target = path.join(
    collaborationPaths(input.root, input.collaborationId).logEntries,
    `${input.id}.json`,
  );
  const existing = await readJsonRecord<LogEntryRecord>(target).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (existing) {
    if (existing.contentHash !== contentHash) {
      throw new CollaborationError(
        'RECORD_CONFLICT',
        'log entry ID already has different content',
      );
    }
    return { entry: existing, duplicate: true };
  }
  const entries = await enumerateJsonRecords(path.dirname(target), {
    maxEntries: 4096,
  });
  if (entries.length >= 4096) {
    throw new CollaborationError(
      'CAPACITY_EXCEEDED',
      'collaboration log already has 4096 entries',
    );
  }
  const entry: LogEntryRecord = {
    schemaVersion: 1,
    id: input.id,
    collaborationId: input.collaborationId,
    category: input.category,
    title: input.title,
    author: input.pin,
    authoredAt: timestamp(input.now),
    whatHappened: input.whatHappened,
    assessment: input.assessment,
    skillImplication: input.skillImplication,
    contentHash,
  };
  try {
    await publishImmutableRecord(target, entry, { root: input.root });
  } catch (error) {
    if (
      error instanceof CollaborationError &&
      error.code === 'RECORD_CONFLICT'
    ) {
      const winner = await readJsonRecord<LogEntryRecord>(target);
      if (winner.contentHash === contentHash)
        return { entry: winner, duplicate: true };
    }
    throw error;
  }
  return { entry, duplicate: false };
}

async function authoritativeEntries(
  root: string,
  collaborationId: string,
): Promise<LogEntryRecord[]> {
  const directory = collaborationPaths(root, collaborationId).logEntries;
  const files = await enumerateJsonRecords(directory, { maxEntries: 4096 });
  const entries = await Promise.all(
    files.map((file) => readJsonRecord<LogEntryRecord>(file)),
  );
  for (const entry of entries) {
    const actual = canonicalHash({
      collaborationId: entry.collaborationId,
      id: entry.id,
      category: entry.category,
      title: entry.title,
      author: entry.author,
      whatHappened: entry.whatHappened,
      assessment: entry.assessment,
      skillImplication: entry.skillImplication,
    });
    if (actual !== entry.contentHash) {
      throw new CollaborationError(
        'MALFORMED_RECORD',
        `log entry ${entry.id} has an invalid content hash`,
      );
    }
  }
  return entries.toSorted(
    (left, right) =>
      left.authoredAt.localeCompare(right.authoredAt) ||
      left.author.runtime.localeCompare(right.author.runtime) ||
      left.author.sessionId.localeCompare(right.author.sessionId) ||
      left.id.localeCompare(right.id),
  );
}

function sourceDigest(entries: LogEntryRecord[]): string {
  return canonicalHash(
    entries.map((entry) => ({
      id: entry.id,
      hash: entry.contentHash,
      authoredAt: entry.authoredAt,
    })),
  );
}

function renderMarkdown(
  collaboration: CollaborationRecord,
  entries: LogEntryRecord[],
  digest: string,
): string {
  const sections = entries.map((entry) =>
    [
      `## ${entry.title}`,
      '',
      `- Entry: \`${entry.id}\``,
      `- Category: ${entry.category}`,
      `- Author: \`${entry.author.runtime}:${entry.author.sessionId}\``,
      `- Time: ${entry.authoredAt}`,
      `- Assessment: ${entry.assessment}`,
      '',
      entry.whatHappened,
      '',
      `**Skill implication:** ${entry.skillImplication}`,
    ].join('\n'),
  );
  return [
    `# ${collaboration.label}`,
    '',
    `- Collaboration: \`${collaboration.id}\``,
    `- Created: ${collaboration.createdAt}`,
    `- Task: ${collaboration.task}`,
    '',
    `<!-- source-set-digest: ${digest} -->`,
    '',
    ...sections.flatMap((section) => [section, '']),
  ].join('\n');
}

async function writeView(file: string, markdown: string): Promise<void> {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'rendered log directory is unsafe',
    );
  }
  await inspectRenderedView(file, path.dirname(path.dirname(file))).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    },
  );
  const temporary = path.join(
    directory,
    `.collaboration.md.tmp-${process.pid}-${randomUUID()}`,
  );
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(markdown, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
    const directoryHandle = await open(directory, 'r');
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function renderLog(input: {
  root: string;
  collaborationId: string;
  hooks?: { afterSnapshot?: () => void | Promise<void> };
}): Promise<{
  path: string;
  markdown: string;
  digest: string;
  staleAfterRender: boolean;
}> {
  const entries = await authoritativeEntries(input.root, input.collaborationId);
  const collaboration = await readJsonRecord<CollaborationRecord>(
    collaborationPaths(input.root, input.collaborationId).collaboration,
  );
  const digest = sourceDigest(entries);
  const markdown = renderMarkdown(collaboration, entries, digest);
  await input.hooks?.afterSnapshot?.();
  const file = collaborationPaths(
    input.root,
    input.collaborationId,
  ).renderedLog;
  await writeView(file, markdown);
  const after = sourceDigest(
    await authoritativeEntries(input.root, input.collaborationId),
  );
  return { path: file, markdown, digest, staleAfterRender: after !== digest };
}

export async function getLogView(input: {
  root: string;
  collaborationId: string;
}): Promise<{
  path: string;
  markdown: string | null;
  digest: string;
  stale: boolean;
}> {
  const entries = await authoritativeEntries(input.root, input.collaborationId);
  const digest = sourceDigest(entries);
  const file = collaborationPaths(
    input.root,
    input.collaborationId,
  ).renderedLog;
  const markdown = await inspectRenderedView(file, input.root).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  const renderedDigest = markdown?.match(
    /<!-- source-set-digest: ([a-f0-9]{64}) -->/u,
  )?.[1];
  return { path: file, markdown, digest, stale: renderedDigest !== digest };
}

export async function inspectRenderedView(
  file: string,
  root: string,
  options: { expectedUid?: number; maxBytes?: number } = {},
): Promise<string> {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'rendered log must be a regular file',
    );
  }
  const expectedUid = options.expectedUid ?? process.getuid?.();
  if (expectedUid !== undefined && info.uid !== expectedUid) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'rendered log owner does not match the current user',
    );
  }
  const maxBytes = options.maxBytes ?? 512 * 1024;
  if (info.size > maxBytes) {
    throw new CollaborationError(
      'RECORD_TOO_LARGE',
      `rendered log exceeds ${maxBytes} bytes`,
    );
  }
  const canonicalRoot = await realpath(root);
  const canonicalFile = await realpath(file);
  const relative = path.relative(canonicalRoot, canonicalFile);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new CollaborationError(
      'UNSAFE_PATH',
      'rendered log escapes the collaboration root',
    );
  }
  return readFile(file, 'utf8');
}
