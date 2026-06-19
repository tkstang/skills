import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ProviderAdapter } from './adapters.js';
import type {
  ConsensusCliRunRequest,
  OutputMode,
  StructuredOutputStrategy,
} from './types.js';

export interface ProviderInvocation {
  executable: string;
  argv: string[];
  stdin: string;
  cwd?: string;
  output_mode: OutputMode;
  strategy: StructuredOutputStrategy;
  redacted_command: string[];
  last_message_file?: string;
  shell: false;
}

export interface BuildProviderInvocationOptions {
  strategy?: StructuredOutputStrategy;
  inlineJsonSchema?: string;
}

export type ProviderInvocationBuilder = (
  request: ConsensusCliRunRequest,
  options?: BuildProviderInvocationOptions,
) => ProviderInvocation;

export function buildProviderInvocation(
  adapter: ProviderAdapter,
  request: ConsensusCliRunRequest,
  options: BuildProviderInvocationOptions = {},
): ProviderInvocation {
  return adapter.buildInvocation(request, {
    strategy: options.strategy ?? defaultStrategy(adapter),
    inlineJsonSchema: options.inlineJsonSchema,
  });
}

export const buildClaudeInvocation: ProviderInvocationBuilder = (
  request,
  options = {},
) => {
  const strategy = options.strategy ?? 'prompt_only';
  const argv = ['--print', '--output-format', 'json'];
  const redactedArgv = ['--print', '--output-format', 'json'];
  if (strategy === 'provider_validated') {
    if (!options.inlineJsonSchema) {
      throw new Error(
        'Claude provider-validated invocation requires an inline JSON schema.',
      );
    }
    argv.push('--json-schema', options.inlineJsonSchema);
    redactedArgv.push('--json-schema', '<inline-json-schema>');
  }
  if (request.model) {
    argv.push('--model', request.model);
    redactedArgv.push('--model', request.model);
  }
  if (request.effort) {
    argv.push('--effort', request.effort);
    redactedArgv.push('--effort', request.effort);
  }
  const claudePermissionMode = mapClaudePermissionMode(
    request.runtime_policy?.permission_mode,
  );
  if (claudePermissionMode) {
    argv.push('--permission-mode', claudePermissionMode);
    redactedArgv.push('--permission-mode', claudePermissionMode);
  }

  return invocation({
    executable: 'claude',
    argv,
    redactedArgv,
    request,
    strategy,
    outputMode: 'stdout_json',
  });
};

export const buildCodexInvocation: ProviderInvocationBuilder = (
  request,
  options = {},
) => {
  const strategy = options.strategy ?? 'prompt_only';
  const lastMessageFile = codexLastMessageFile();
  const argv = ['exec', '--json', '--output-last-message', lastMessageFile];
  if (strategy === 'constrained_native') {
    argv.push('--output-schema', request.schema_path);
  }
  if (request.model) argv.push('--model', request.model);
  if (request.effort) {
    argv.push(
      '-c',
      codexConfigOverride('model_reasoning_effort', request.effort),
    );
  }
  if (request.runtime_policy?.sandbox) {
    argv.push('--sandbox', request.runtime_policy.sandbox);
  }
  const approvalPolicy =
    request.runtime_policy?.approval_policy ??
    (request.runtime_policy?.permission_mode === 'non-interactive'
      ? 'never'
      : undefined);
  if (approvalPolicy) {
    argv.push('-c', codexConfigOverride('approval_policy', approvalPolicy));
  }

  return invocation({
    executable: 'codex',
    argv,
    request,
    strategy,
    outputMode: 'last_message_file',
    lastMessageFile,
  });
};

export const buildCursorInvocation: ProviderInvocationBuilder = (
  request,
  options = {},
) => {
  const strategy =
    options.strategy === 'submit_tool_candidate'
      ? 'prompt_only'
      : (options.strategy ?? 'prompt_only');
  const argv = ['--output-format', 'json', '--force'];

  return invocation({
    executable: 'cursor-agent',
    argv,
    request,
    strategy,
    outputMode: 'stdout_json',
  });
};

function invocation(input: {
  executable: string;
  argv: string[];
  redactedArgv?: string[];
  request: ConsensusCliRunRequest;
  strategy: StructuredOutputStrategy;
  outputMode: OutputMode;
  lastMessageFile?: string;
}): ProviderInvocation {
  return {
    executable: input.executable,
    argv: input.argv,
    stdin: input.request.prompt,
    ...(input.request.cwd ? { cwd: input.request.cwd } : {}),
    output_mode: input.outputMode,
    strategy: input.strategy,
    redacted_command: [
      input.executable,
      ...(input.redactedArgv ?? input.argv),
    ],
    ...(input.lastMessageFile
      ? { last_message_file: input.lastMessageFile }
      : {}),
    shell: false,
  };
}

function mapClaudePermissionMode(permissionMode: string | undefined) {
  if (!permissionMode || permissionMode === 'non-interactive') {
    return undefined;
  }
  if (permissionMode === 'read-only') {
    return 'plan';
  }
  return permissionMode;
}

function codexConfigOverride(key: string, value: string) {
  return `${key}=${JSON.stringify(value)}`;
}

function codexLastMessageFile() {
  return path.join(
    tmpdir(),
    `consensus-codex-last-message-${randomUUID()}.txt`,
  );
}

function defaultStrategy(adapter: ProviderAdapter): StructuredOutputStrategy {
  return (
    adapter.capabilities.schema_strategies.find(
      (strategy) => strategy !== 'submit_tool_candidate',
    ) ?? 'prompt_only'
  );
}
