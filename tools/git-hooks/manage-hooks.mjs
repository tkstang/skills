#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// pre-commit runs lint-staged (oxlint --fix + oxfmt --write on staged files) and
// then the OAT drift check. It carries OAT's marked block verbatim so `oat` treats
// the block as already present and leaves the symlinked hook alone.
const hooks = ['commit-msg', 'pre-commit', 'pre-push', 'post-checkout'];
const hooksSourceDir = path.resolve('tools/git-hooks');
const hooksSourceDisplayDir = 'tools/git-hooks';
const gitHooksDir = resolveGitHooksDir();
const disabledHooksFile = path.join(gitHooksDir, '.disabled-hooks');

function resolveGitHooksDir() {
  const gitHooksPath = execFileSync('git', ['rev-parse', '--git-path', 'hooks'])
    .toString()
    .trim();

  return path.resolve(gitHooksPath);
}

function showUsage() {
  console.log(`
Usage: node tools/git-hooks/manage-hooks.mjs <action> [hook-name]

Actions:
  setup               Setup Git hooks (respects intentionally disabled hooks)
  enable-all          Enable all Git hooks (force)
  disable-all         Disable all Git hooks
  enable <hook>       Enable specific hook
  disable <hook>      Disable specific hook
  status              Show status of all hooks

Available hooks: ${hooks.join(', ')}

Examples:
  node tools/git-hooks/manage-hooks.mjs disable-all
  node tools/git-hooks/manage-hooks.mjs enable pre-commit
  node tools/git-hooks/manage-hooks.mjs disable commit-msg
  node tools/git-hooks/manage-hooks.mjs status
`);
}

function getDisabledHooks() {
  if (!fs.existsSync(disabledHooksFile)) {
    return new Set();
  }
  const content = fs.readFileSync(disabledHooksFile, 'utf-8');
  return new Set(content.split('\n').filter((line) => line.trim()));
}

function markHookAsDisabled(hookName) {
  fs.mkdirSync(gitHooksDir, { recursive: true });
  const disabled = getDisabledHooks();
  disabled.add(hookName);
  fs.writeFileSync(disabledHooksFile, `${Array.from(disabled).join('\n')}\n`);
}

function unmarkHookAsDisabled(hookName) {
  const disabled = getDisabledHooks();
  disabled.delete(hookName);
  if (disabled.size > 0) {
    fs.writeFileSync(disabledHooksFile, `${Array.from(disabled).join('\n')}\n`);
  } else if (fs.existsSync(disabledHooksFile)) {
    fs.unlinkSync(disabledHooksFile);
  }
}

function isHookDisabled(hookName) {
  return getDisabledHooks().has(hookName);
}

/**
 * Check if a Git hook is enabled (symlink exists and target is executable).
 * @param {string} hookName - The name of the hook to check.
 * @returns {boolean} True if hook is enabled.
 */
function isHookEnabled(hookName) {
  const hookPath = path.join(gitHooksDir, hookName);

  try {
    const linkStats = fs.lstatSync(hookPath);
    if (!linkStats.isSymbolicLink() && !linkStats.isFile()) {
      return false;
    }

    const stats = fs.statSync(hookPath);
    return !!(stats.mode & 0o100);
  } catch {
    return false;
  }
}

/**
 * Enable a Git hook by symlinking it from tools/git-hooks into Git's hooks dir.
 * @param {string} hookName - The name of the hook to enable.
 */
function enableHook(hookName) {
  const sourcePath = path.join(hooksSourceDir, hookName);
  const hookPath = path.join(gitHooksDir, hookName);

  if (fs.existsSync(sourcePath)) {
    fs.mkdirSync(gitHooksDir, { recursive: true });

    if (
      fs.existsSync(hookPath) ||
      fs.lstatSync(hookPath, { throwIfNoEntry: false })
    ) {
      fs.unlinkSync(hookPath);
    }

    const relativeSourcePath = path.relative(gitHooksDir, sourcePath);
    fs.symlinkSync(relativeSourcePath, hookPath);

    unmarkHookAsDisabled(hookName);
    console.log(`✅ Enabled ${hookName} hook`);
  } else {
    console.log(
      `❌ Hook file ${path.join(hooksSourceDisplayDir, hookName)} not found`,
    );
  }
}

function disableHook(hookName) {
  const hookPath = path.join(gitHooksDir, hookName);
  if (fs.existsSync(hookPath)) {
    fs.unlinkSync(hookPath);
    markHookAsDisabled(hookName);
    console.log(`🚫 Disabled ${hookName} hook`);
  } else {
    console.log(`❌ Hook file ${hookPath} not found`);
  }
}

function showStatus() {
  console.log('\n📋 Git Hooks Status:');
  console.log('===================');

  hooks.forEach((hook) => {
    const enabled = isHookEnabled(hook);
    const disabled = isHookDisabled(hook);
    let status;
    if (enabled) {
      status = '✅ Enabled';
    } else if (disabled) {
      status = '🚫 Disabled (intentional)';
    } else {
      status = '⚪ Not installed';
    }
    console.log(`${hook.padEnd(15)} ${status}`);
  });
  console.log();
}

const [action, hookName] = process.argv.slice(2);

if (!action) {
  showUsage();
  process.exit(1);
}

switch (action) {
  case 'enable-all':
    try {
      execSync('git config --unset core.hooksPath', { stdio: 'ignore' });
    } catch {
      // Ignore error if hooksPath wasn't set.
    }
    hooks.forEach(enableHook);
    console.log('✅ All hooks enabled');
    break;

  case 'setup': {
    try {
      execSync('git config --unset core.hooksPath', { stdio: 'ignore' });
    } catch {
      // Ignore error if hooksPath wasn't set.
    }

    const allHooksReady = hooks.every(
      (hook) => isHookDisabled(hook) || isHookEnabled(hook),
    );

    if (allHooksReady) {
      console.log('✅ Git hooks already configured');
      process.exit(0);
    }

    hooks.forEach((hook) => {
      if (isHookDisabled(hook)) {
        console.log(`⏭️  Skipped ${hook} hook (intentionally disabled)`);
      } else if (!isHookEnabled(hook)) {
        enableHook(hook);
      } else {
        console.log(`⏭️  Skipped ${hook} hook (already exists)`);
      }
    });
    console.log('✅ Git hooks setup complete');
    break;
  }

  case 'disable-all':
    hooks.forEach(disableHook);
    console.log('🚫 All hooks disabled');
    break;

  case 'enable':
    if (!hookName || !hooks.includes(hookName)) {
      console.log(`❌ Please specify a valid hook: ${hooks.join(', ')}`);
      process.exit(1);
    }
    enableHook(hookName);
    break;

  case 'disable':
    if (!hookName || !hooks.includes(hookName)) {
      console.log(`❌ Please specify a valid hook: ${hooks.join(', ')}`);
      process.exit(1);
    }
    disableHook(hookName);
    break;

  case 'status':
    showStatus();
    break;

  default:
    console.log(`❌ Unknown action: ${action}`);
    showUsage();
    process.exit(1);
}
