import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

// Shared YAML-frontmatter read/patch helper for the internal-flag tooling.
//
// These helpers operate on raw frontmatter lines rather than parsing and
// re-serializing the whole document, so existing keys, ordering, comments, and
// the body are preserved byte-for-byte. They target the simple block-style
// frontmatter the OAT tooling skills (`.agents/skills/**/SKILL.md`) use.

/**
 * Split a SKILL.md document into its frontmatter and body around the leading
 * `---` fences. Returns `null` when there is no leading frontmatter block.
 *
 * @param {string} content
 * @returns {{
 *   eol: string,
 *   openFence: string,
 *   closeFence: string,
 *   frontmatterLines: string[],
 *   bodyLines: string[],
 * } | null}
 */
export function parseFrontmatter(content) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(eol);
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return null;
  }

  let closeIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      closeIndex = index;
      break;
    }
  }
  if (closeIndex === -1) {
    return null;
  }

  return {
    eol,
    openFence: lines[0],
    closeFence: lines[closeIndex],
    frontmatterLines: lines.slice(1, closeIndex),
    bodyLines: lines.slice(closeIndex + 1),
  };
}

/** Index of the top-level `metadata:` block line, or -1 when absent. */
function findMetadataIndex(frontmatterLines) {
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    if (/^metadata:\s*$/u.test(frontmatterLines[index])) {
      return index;
    }
  }
  return -1;
}

/** Detect the indentation used by nested keys under `metadata:` (default 2sp). */
function detectNestedIndent(frontmatterLines, metadataIndex) {
  for (
    let index = metadataIndex + 1;
    index < frontmatterLines.length;
    index += 1
  ) {
    const line = frontmatterLines[index];
    if (line.trim() === '') continue;
    const match = line.match(/^(\s+)\S/u);
    if (match) {
      return match[1];
    }
    // A non-indented line means the metadata block has no nested keys yet.
    break;
  }
  return '  ';
}

/** True when the frontmatter lines carry `metadata.internal: true`. */
function frontmatterHasInternal(frontmatterLines) {
  const metadataIndex = findMetadataIndex(frontmatterLines);
  if (metadataIndex === -1) {
    return false;
  }
  // Detect the direct-child indent depth of the metadata: block.
  // Only an `internal:` key at exactly this depth (not deeper nesting) counts.
  // This prevents a key like `metadata.visibility.internal` from being treated
  // as `metadata.internal`.
  const indent = detectNestedIndent(frontmatterLines, metadataIndex);
  for (
    let index = metadataIndex + 1;
    index < frontmatterLines.length;
    index += 1
  ) {
    const line = frontmatterLines[index];
    if (line.trim() === '') continue;
    // A non-indented line ends the metadata block.
    if (!/^\s/u.test(line)) {
      break;
    }
    // Match `internal:` only at the direct-child indent depth (not deeper).
    const match = line.match(
      new RegExp(`^${indent}internal:\\s*(.+?)\\s*$`, 'u'),
    );
    if (match) {
      const value = match[1].trim().replace(/^["']|["']$/gu, '');
      return value === 'true';
    }
  }
  return false;
}

/**
 * @param {string} content SKILL.md document text
 * @returns {boolean} whether the document declares `metadata.internal: true`
 */
export function hasInternalFlag(content) {
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return false;
  }
  return frontmatterHasInternal(parsed.frontmatterLines);
}

/**
 * Add `metadata.internal: true` to a SKILL.md document, creating the
 * `metadata:` block when absent. Idempotent: already-flagged content is
 * returned unchanged. Preserves all other frontmatter keys and the body.
 *
 * @param {string} content SKILL.md document text
 * @returns {{ content: string, changed: boolean }}
 */
export function addInternalFlag(content) {
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    throw new Error(
      'cannot add metadata.internal: no YAML frontmatter block found',
    );
  }
  if (frontmatterHasInternal(parsed.frontmatterLines)) {
    return { content, changed: false };
  }

  const { eol, openFence, closeFence, frontmatterLines, bodyLines } = parsed;
  const metadataIndex = findMetadataIndex(frontmatterLines);

  let nextFrontmatter;
  if (metadataIndex === -1) {
    nextFrontmatter = [...frontmatterLines, 'metadata:', '  internal: true'];
  } else {
    const indent = detectNestedIndent(frontmatterLines, metadataIndex);
    nextFrontmatter = [...frontmatterLines];
    nextFrontmatter.splice(metadataIndex + 1, 0, `${indent}internal: true`);
  }

  const rebuilt = [
    openFence,
    ...nextFrontmatter,
    closeFence,
    ...bodyLines,
  ].join(eol);
  return { content: rebuilt, changed: true };
}

/**
 * List the `SKILL.md` files under an OAT skills mirror directory.
 *
 * Symlinked skill directories (e.g. `.agents/skills/session-observer` →
 * `skills/session-observer`) are skipped: those resolve to canonical standalone
 * skills that must stay publicly discoverable and are not OAT-synced mirrors —
 * flagging them would both hide a public skill and require a skill-version bump.
 *
 * @param {string} skillsDir directory containing one subdir per skill
 * @returns {Promise<string[]>} sorted absolute paths to each SKILL.md
 */
export async function listAgentSkillFiles(skillsDir) {
  let entries;
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      continue;
    }
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    try {
      const stats = await lstat(skillFile);
      if (!stats.isFile()) {
        continue;
      }
    } catch {
      continue;
    }
    files.push(skillFile);
  }

  return files.toSorted((left, right) => left.localeCompare(right));
}
