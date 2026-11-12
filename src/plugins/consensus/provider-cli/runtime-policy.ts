import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

import { PROVIDER_EXECUTABLE_ENV } from './executable.js';
import type {
  ConsensusCliRunRequest,
  ProviderCapabilities,
  ProviderErrorCode,
  ProviderRuntimePolicy,
} from './types.js';

export interface ProviderOptionValidationSuccess {
  ok: true;
}

export interface ProviderOptionValidationFailure {
  ok: false;
  code: Extract<ProviderErrorCode, 'PROVIDER_UNSUPPORTED_OPTION'>;
  option: string;
  message: string;
}

export type ProviderOptionValidationResult =
  | ProviderOptionValidationSuccess
  | ProviderOptionValidationFailure;

export interface BuildChildEnvironmentInput {
  parentEnv: Record<string, string | undefined>;
  request: ConsensusCliRunRequest;
  hostEnv: Record<string, string>;
}

export interface BuildProviderProbeEnvironmentInput {
  parentEnv: Record<string, string | undefined>;
  provider: string;
}

export interface RedactedRuntimePolicyDiagnostics {
  permission_mode?: string;
  sandbox?: string;
  approval_policy?: string;
  env_allowlist?: string[];
}

const DEFAULT_RUNTIME_POLICY: Required<
  Pick<ProviderRuntimePolicy, 'permission_mode'>
> = {
  permission_mode: 'non-interactive',
};

const BASE_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
] as const;

const PROVIDER_ENV_ALLOWLIST = [
  ['claude', ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']],
  ['codex', ['OPENAI_API_KEY']],
  ['cursor', ['CURSOR_API_KEY']],
] as const;

export function validateProviderOptions(
  request: ConsensusCliRunRequest,
  capabilities: ProviderCapabilities,
): ProviderOptionValidationResult {
  if (request.model && !capabilities.options.model) {
    return unsupported('model', 'Provider does not support model selection.');
  }

  if (request.effort && capabilities.options.effort === null) {
    return unsupported('effort', 'Provider does not support effort selection.');
  }

  const policy = defaultRuntimePolicy(request.runtime_policy);
  const runtimeCapabilities = capabilities.options.runtime_policy;

  const permissionResult = validateOptionValue(
    'runtime_policy.permission_mode',
    policy.permission_mode,
    runtimeCapabilities.permission_modes,
  );
  if (permissionResult) return permissionResult;

  const sandboxResult = validateOptionValue(
    'runtime_policy.sandbox',
    policy.sandbox,
    runtimeCapabilities.sandboxes,
  );
  if (sandboxResult) return sandboxResult;

  const approvalResult = validateOptionValue(
    'runtime_policy.approval_policy',
    policy.approval_policy,
    runtimeCapabilities.approval_policies,
  );
  if (approvalResult) return approvalResult;

  if (
    policy.env_allowlist &&
    policy.env_allowlist.length > 0 &&
    !runtimeCapabilities.env_allowlist
  ) {
    return unsupported(
      'runtime_policy.env_allowlist',
      'Provider does not support child environment allowlist extension.',
    );
  }

  const hasScopedTools = hasScopedToolAccess(policy);
  if (hasScopedTools && request.provider !== 'claude') {
    return unsupported(
      'runtime_policy.scoped_tools',
      'Scoped tool grants are supported only by the Claude provider.',
    );
  }
  if (request.provider === 'claude') {
    const composition = composeClaudePermissionProfile(policy);
    if (!composition.ok) {
      return unsupported(composition.option, composition.message);
    }
  }
  for (const pattern of policy.bash_patterns ?? []) {
    if (!isExactBashPattern(pattern)) {
      return unsupported(
        'runtime_policy.bash_patterns',
        'Bash grants require a single-line command pattern without parentheses or commas, naming a command rather than only wildcards.',
      );
    }
  }
  for (const [field, paths] of [
    ['read_paths', policy.read_paths],
    ['edit_paths', policy.edit_paths],
  ] as const) {
    for (const filePath of paths ?? []) {
      if (
        !path.isAbsolute(filePath) ||
        path.normalize(filePath) !== filePath ||
        filePath.split(path.sep).includes('..') ||
        /[\r\n,*?]/.test(filePath) ||
        filePath.includes('[') ||
        filePath.includes(']')
      ) {
        return unsupported(
          `runtime_policy.${field}`,
          `${field} requires exact absolute paths without parent traversal or glob characters.`,
        );
      }
      try {
        const target = statSync(filePath, { throwIfNoEntry: false });
        if (target) {
          if (!target.isFile() || realpathSync(filePath) !== filePath) {
            return unsupported(
              `runtime_policy.${field}`,
              `${field} requires canonical regular-file targets, not directories or symlinks.`,
            );
          }
        } else if (
          field === 'read_paths' ||
          realpathSync(path.dirname(filePath)) !== path.dirname(filePath)
        ) {
          return unsupported(
            `runtime_policy.${field}`,
            `${field} requires an existing canonical file (or an existing canonical parent for a new edit file).`,
          );
        }
      } catch {
        return unsupported(
          `runtime_policy.${field}`,
          `${field} requires an existing canonical file (or an existing canonical parent for a new edit file).`,
        );
      }
    }
  }
  for (const domain of policy.web_fetch_domains ?? []) {
    if (
      domain.length > 253 ||
      !/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
        domain,
      )
    ) {
      return unsupported(
        'runtime_policy.web_fetch_domains',
        'WebFetch grants require exact domain names without schemes, ports, or wildcards.',
      );
    }
  }

  return { ok: true };
}

export function hasScopedToolAccess(policy: ProviderRuntimePolicy = {}) {
  return Boolean(
    policy.read_paths?.length ||
    policy.edit_paths?.length ||
    policy.bash_patterns?.length ||
    policy.web_search ||
    policy.web_fetch_domains?.length,
  );
}

// Claude's permission flags for one effective runtime policy.
// `restricted` adds `--permission-prompts none --strict-mcp-config`.
export interface ClaudePermissionComposition {
  ok: true;
  // Claude `--permission-mode` value; undefined keeps the provider default.
  mode?: 'plan' | 'dontAsk' | 'acceptEdits';
  tools?: string[];
  allowed_tools: string[];
  restricted: boolean;
}

export interface ClaudePermissionCompositionFailure {
  ok: false;
  option: string;
  message: string;
}

// The only accepted pairings of a Claude permission mode and scoped grants:
//
// | Profile                          | Mode        | --tools                         | --allowedTools        |
// | -------------------------------- | ----------- | ------------------------------- | --------------------- |
// | read-only, no grants             | plan        | provider default                | none                  |
// | read-only + read grants          | dontAsk     | Read,Glob,Grep                  | Read(<path>) per grant |
// | non-interactive, no grants       | (default)   | provider default                | none                  |
// | non-interactive + scoped grants  | dontAsk     | the granted tools               | each grant            |
// | workspace-write                  | acceptEdits | Read,Glob,Grep,Edit,Write[,Bash] | Bash(<pattern>) each |
//
// `--tools` is always explicit when grants apply, because `--allowedTools`
// alone does not exclude other tools. Every other pairing is rejected.
export function composeClaudePermissionProfile(
  policy: ProviderRuntimePolicy,
): ClaudePermissionComposition | ClaudePermissionCompositionFailure {
  const mode = policy.permission_mode ?? DEFAULT_RUNTIME_POLICY.permission_mode;
  const readPaths = policy.read_paths ?? [];
  const editPaths = policy.edit_paths ?? [];
  const bashPatterns = policy.bash_patterns ?? [];
  const webFetchDomains = policy.web_fetch_domains ?? [];
  const webSearch = Boolean(policy.web_search);
  const readRules = readPaths.map((filePath) => `Read(/${filePath})`);

  if (mode === 'read-only') {
    if (
      editPaths.length > 0 ||
      bashPatterns.length > 0 ||
      webSearch ||
      webFetchDomains.length > 0
    ) {
      return compositionFailure(
        'Claude read-only accepts only --allow-read grants; use non-interactive for edit or web grants and workspace-write for Bash grants.',
      );
    }
    if (readPaths.length === 0) {
      return { ok: true, mode: 'plan', allowed_tools: [], restricted: false };
    }
    return {
      ok: true,
      mode: 'dontAsk',
      tools: ['Read', 'Glob', 'Grep'],
      allowed_tools: readRules,
      restricted: true,
    };
  }

  if (mode === 'non-interactive') {
    if (bashPatterns.length > 0) {
      return compositionFailure(
        'Claude Bash grants require --permission-mode workspace-write.',
      );
    }
    const allowedTools = [
      ...readRules,
      ...editPaths.map((filePath) => `Edit(/${filePath})`),
      ...(webSearch ? ['WebSearch'] : []),
      ...webFetchDomains.map((domain) => `WebFetch(domain:${domain})`),
    ];
    if (allowedTools.length === 0) {
      return { ok: true, allowed_tools: [], restricted: false };
    }
    return {
      ok: true,
      mode: 'dontAsk',
      tools: [
        ...(readPaths.length > 0 ? ['Read'] : []),
        ...(editPaths.length > 0 ? ['Edit', 'Write'] : []),
        ...(webSearch ? ['WebSearch'] : []),
        ...(webFetchDomains.length > 0 ? ['WebFetch'] : []),
      ],
      allowed_tools: allowedTools,
      restricted: true,
    };
  }

  if (mode === 'workspace-write') {
    if (
      readPaths.length > 0 ||
      editPaths.length > 0 ||
      webSearch ||
      webFetchDomains.length > 0
    ) {
      return compositionFailure(
        'Claude workspace-write accepts only --allow-bash grants; its file tools already cover the working directory.',
      );
    }
    return {
      ok: true,
      mode: 'acceptEdits',
      tools: [
        'Read',
        'Glob',
        'Grep',
        'Edit',
        'Write',
        ...(bashPatterns.length > 0 ? ['Bash'] : []),
      ],
      allowed_tools: bashPatterns.map((pattern) => `Bash(${pattern})`),
      restricted: true,
    };
  }

  return compositionFailure(`Unsupported Claude permission mode: ${mode}.`);
}

function compositionFailure(
  message: string,
): ClaudePermissionCompositionFailure {
  return { ok: false, option: 'runtime_policy.permission_mode', message };
}

// One Claude `Bash(<pattern>)` rule: a single line, no rule delimiters, and
// at least one character that names a command rather than a wildcard.
function isExactBashPattern(pattern: string) {
  return (
    pattern.length > 0 &&
    pattern.length <= 256 &&
    pattern.trim() === pattern &&
    !/[(),]/.test(pattern) &&
    ![...pattern].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    }) &&
    /[^\s*:]/.test(pattern)
  );
}

export function defaultRuntimePolicy(
  policy: ProviderRuntimePolicy = {},
): ProviderRuntimePolicy {
  return {
    permission_mode:
      policy.permission_mode ?? DEFAULT_RUNTIME_POLICY.permission_mode,
    ...(policy.sandbox ? { sandbox: policy.sandbox } : {}),
    ...(policy.approval_policy
      ? { approval_policy: policy.approval_policy }
      : {}),
    ...(policy.env_allowlist ? { env_allowlist: policy.env_allowlist } : {}),
    ...(policy.read_paths ? { read_paths: policy.read_paths } : {}),
    ...(policy.edit_paths ? { edit_paths: policy.edit_paths } : {}),
    ...(policy.bash_patterns ? { bash_patterns: policy.bash_patterns } : {}),
    ...(policy.web_search ? { web_search: true } : {}),
    ...(policy.web_fetch_domains
      ? { web_fetch_domains: policy.web_fetch_domains }
      : {}),
  };
}

export function buildChildEnvironment({
  parentEnv,
  request,
  hostEnv,
}: BuildChildEnvironmentInput): Record<string, string> {
  const allowedNames = new Set<string>([
    ...BASE_ENV_ALLOWLIST,
    ...providerEnvAllowlist(request.provider),
    ...(request.runtime_policy?.env_allowlist ?? []),
  ]);
  // Parent-owned program overrides stay with consensus, even when a request
  // names them in env_allowlist.
  for (const name of Object.values(PROVIDER_EXECUTABLE_ENV)) {
    allowedNames.delete(name);
  }
  const childEnv: Record<string, string> = {};

  for (const name of allowedNames) {
    const value = parentEnv[name];
    if (value !== undefined) childEnv[name] = value;
  }

  return {
    ...childEnv,
    ...hostEnv,
  };
}

export function buildProviderProbeEnvironment({
  parentEnv,
  provider,
}: BuildProviderProbeEnvironmentInput): Record<string, string> {
  const allowedNames = new Set<string>([
    ...BASE_ENV_ALLOWLIST,
    ...providerEnvAllowlist(provider),
  ]);
  const probeEnv: Record<string, string> = {};

  for (const name of allowedNames) {
    const value = parentEnv[name];
    if (value !== undefined) probeEnv[name] = value;
  }

  return probeEnv;
}

function providerEnvAllowlist(provider: string): readonly string[] {
  return PROVIDER_ENV_ALLOWLIST.find(([id]) => id === provider)?.[1] ?? [];
}

export function redactedRuntimePolicyDiagnostics(
  policy: ProviderRuntimePolicy = {},
): RedactedRuntimePolicyDiagnostics {
  const effectivePolicy = defaultRuntimePolicy(policy);
  return {
    permission_mode: effectivePolicy.permission_mode,
    ...(effectivePolicy.sandbox ? { sandbox: effectivePolicy.sandbox } : {}),
    ...(effectivePolicy.approval_policy
      ? { approval_policy: effectivePolicy.approval_policy }
      : {}),
    ...(effectivePolicy.env_allowlist
      ? { env_allowlist: [...effectivePolicy.env_allowlist] }
      : {}),
  };
}

function validateOptionValue(
  option: string,
  value: string | undefined,
  supportedValues: string[] | undefined,
): ProviderOptionValidationFailure | undefined {
  if (!value) return undefined;
  if (supportedValues?.includes(value)) return undefined;

  return unsupported(
    option,
    supportedValues
      ? `Unsupported ${option}: ${value}.`
      : `Provider does not support ${option}.`,
  );
}

function unsupported(
  option: string,
  message: string,
): ProviderOptionValidationFailure {
  return {
    ok: false,
    code: 'PROVIDER_UNSUPPORTED_OPTION',
    option,
    message,
  };
}
