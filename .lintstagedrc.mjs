// Incremental enforcement: only staged files are linted/formatted, so the
// (currently unformatted) rest of the repo is migrated gradually as files are
// touched. The repo-wide one-time format lands in a separate follow-up.

// Files that must never be reformatted/linted here:
//   - OAT project/reference artifacts (.oat) because repo formatter config
//     ignores them and passing only ignored files makes oxfmt fail
//   - generated transcript-core copies (drift-guarded against canonical source)
//   - generated consensus runtime outputs (built from canonical TypeScript)
//   - OAT-synced provider views (.agents, .claude/rules, .cursor/rules) kept
//     byte-identical to their canonical sources by `oat sync`
//   - agent-instruction files (AGENTS.md / CLAUDE.md) at every level: the root
//     file carries an `oat sync`-regenerated <!-- OAT tools --> block that oat
//     sync does not keep oxfmt-clean, so formatting fights the generator
const isExcluded = (file) =>
  file.endsWith('/scripts/lib/runtimes.mjs') ||
  file.endsWith(
    '/plugins/consensus/skills/refine/scripts/consensus-loop.mjs',
  ) ||
  file.endsWith(
    '/plugins/consensus/skills/evaluate/scripts/consensus-loop.mjs',
  ) ||
  file.endsWith(
    '/plugins/consensus/skills/refine/scripts/consensus-refine.mjs',
  ) ||
  /(^|\/)\.oat\//.test(file) ||
  /(^|\/)\.agents\//.test(file) ||
  /(^|\/)\.(claude|cursor)\/rules\//.test(file) ||
  /(^|\/)(AGENTS|CLAUDE)\.md$/.test(file);

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
