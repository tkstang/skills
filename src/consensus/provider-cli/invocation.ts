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
  shell: false;
}

export interface BuildProviderInvocationOptions {
  strategy?: StructuredOutputStrategy;
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
  });
}

export const buildClaudeInvocation: ProviderInvocationBuilder = (
  request,
  options = {},
) => {
  const strategy = options.strategy ?? 'prompt_only';
  const argv = ['--print', '--output-format', 'json'];
  if (strategy === 'provider_validated') {
    argv.push('--json-schema', request.schema_path);
  }
  if (request.model) argv.push('--model', request.model);
  if (request.effort) argv.push('--effort', request.effort);

  return invocation({
    executable: 'claude',
    argv,
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
  const argv = ['exec', '--json'];
  if (strategy === 'constrained_native') {
    argv.push('--output-schema', request.schema_path);
  }
  if (request.model) argv.push('--model', request.model);
  if (request.effort) argv.push('--reasoning-effort', request.effort);
  if (request.runtime_policy?.sandbox) {
    argv.push('--sandbox', request.runtime_policy.sandbox);
  }
  if (request.runtime_policy?.approval_policy) {
    argv.push('--approval-policy', request.runtime_policy.approval_policy);
  }

  return invocation({
    executable: 'codex',
    argv,
    request,
    strategy,
    outputMode: 'stdout_json',
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
  request: ConsensusCliRunRequest;
  strategy: StructuredOutputStrategy;
  outputMode: OutputMode;
}): ProviderInvocation {
  return {
    executable: input.executable,
    argv: input.argv,
    stdin: input.request.prompt,
    ...(input.request.cwd ? { cwd: input.request.cwd } : {}),
    output_mode: input.outputMode,
    strategy: input.strategy,
    redacted_command: [input.executable, ...input.argv],
    shell: false,
  };
}

function defaultStrategy(adapter: ProviderAdapter): StructuredOutputStrategy {
  return (
    adapter.capabilities.schema_strategies.find(
      (strategy) => strategy !== 'submit_tool_candidate',
    ) ?? 'prompt_only'
  );
}
