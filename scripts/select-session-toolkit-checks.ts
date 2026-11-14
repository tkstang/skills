import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

// Runs directly with Node's native type stripping before dependency installation.
// Keep this entrypoint dependency-free and use only erasable TypeScript syntax.
try {
  let relevant = true;
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const base = process.env.PR_BASE_SHA ?? '';
    const head = process.env.PR_HEAD_SHA ?? '';
    for (const revision of [base, head]) {
      if (!/^[0-9a-f]{40}$/.test(revision)) {
        throw new Error('E_INVALID_PR_REVISION: Invalid PR revision');
      }
      execFileSync('git', ['cat-file', '-e', `${revision}^{commit}`]);
    }
    const comparison = execFileSync('git', ['merge-base', base, head], {
      encoding: 'utf8',
    }).trim();
    // Disable rename detection so both old and new paths are classified.
    const changed = execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', comparison, head],
      { encoding: 'utf8' },
    );
    relevant = changed.split('\0').some((path) => {
      if (!path) return false;
      return !(
        ['README.md', 'CONTRIBUTING.md', 'AGENTS.md'].includes(path) ||
        path.startsWith('documentation/') ||
        (path.startsWith('.oat/repo/') && path.endsWith('.md'))
      );
    });
  }
  // Write only after every Git operation succeeds. A failure must never skip proof.
  appendFileSync(process.env.GITHUB_OUTPUT!, `relevant=${relevant}\n`);
} catch (error) {
  console.error('E_ARCHIVE_SELECTION:', error);
  process.exitCode = 1;
}
