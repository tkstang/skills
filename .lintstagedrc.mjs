// Incremental enforcement: only staged files are linted/formatted, so the
// (currently unformatted) rest of the repo is migrated gradually as files are
// touched. The repo-wide one-time format lands in a separate follow-up.

// Files that must never be reformatted/linted here:
//   - generated transcript-core copies (drift-guarded against canonical source)
//   - OAT-synced provider views (.agents, .claude/rules, .cursor/rules) kept
//     byte-identical to their canonical sources by `oat sync`
const isExcluded = (file) =>
  file.endsWith('/scripts/lib/runtimes.mjs') ||
  /(^|\/)\.agents\//.test(file) ||
  /(^|\/)\.(claude|cursor)\/rules\//.test(file);

const quote = (files) => files.map((f) => `"${f}"`).join(' ');

export default {
  '*.{mjs,js}': (files) => {
    const filtered = files.filter((f) => !isExcluded(f));
    if (filtered.length === 0) return [];
    const list = quote(filtered);
    return [`oxlint --fix ${list}`, `oxfmt --write ${list}`];
  },
  '*.json': (files) => {
    const filtered = files.filter((f) => !isExcluded(f));
    return filtered.length > 0 ? [`oxfmt --write ${quote(filtered)}`] : [];
  },
  '*.md': (files) => {
    const filtered = files.filter((f) => !isExcluded(f));
    return filtered.length > 0 ? [`oxfmt --write ${quote(filtered)}`] : [];
  },
};
