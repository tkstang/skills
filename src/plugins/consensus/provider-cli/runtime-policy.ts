import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

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
  if (hasScopedTools && policy.permission_mode !== 'non-interactive') {
    return unsupported(
      'runtime_policy.permission_mode',
      'Scoped Claude tool grants require non-interactive permission mode.',
    );
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
    policy.web_search ||
    policy.web_fetch_domains?.length,
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
