import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ProviderAdapter } from './adapters.js';
import { composeClaudePermissionProfile } from './runtime-policy.js';
import type {
  ConsensusCliRunRequest,
  OutputMode,
  ProviderPermissionProfile,
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
  cleanup_last_message_file?: boolean;
  // Claude only: the permission controls this invocation applies.
  permission_profile?: ProviderPermissionProfile;
  shell: false;
}

export interface BuildProviderInvocationOptions {
  strategy?: StructuredOutputStrategy;
  inlineJsonSchema?: string;
  lastMessageFile?: string;
  preserveLastMessageFile?: boolean;
  // Continue this exact provider session. Callers validate the id and the
  // adapter's verified continuation capability before building.
  resumeSessionId?: string;
  // Replaces the adapter's command (see resolveProviderExecutable).
  executable?: string;
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
    lastMessageFile: options.lastMessageFile,
    preserveLastMessageFile: options.preserveLastMessageFile,
    resumeSessionId: options.resumeSessionId,
    executable: options.executable,
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
  const permission = composeClaudePermissionProfile(
    request.runtime_policy ?? {},
  );
  if (!permission.ok) {
    // Callers validate the policy first (validateProviderOptions).
    throw new Error(permission.message);
  }
  if (permission.allowed_tools.length > 0) {
    argv.push('--allowedTools', ...permission.allowed_tools);
    redactedArgv.push('--allowedTools', '<scoped-tool-rules>');
  }
  if (permission.tools) {
    argv.push('--tools', permission.tools.join(','));
    redactedArgv.push('--tools', permission.tools.join(','));
  }
  if (permission.restricted) {
    argv.push('--permission-prompts', 'none');
    redactedArgv.push('--permission-prompts', 'none');
  }
  if (permission.mode) {
    argv.push('--permission-mode', permission.mode);
    redactedArgv.push('--permission-mode', permission.mode);
  }
  if (permission.restricted) {
    argv.push('--strict-mcp-config');
    redactedArgv.push('--strict-mcp-config');
  }
  // Explicit same-session resume. Never `--continue` (latest in cwd) or
  // `--fork-session` (new id); never `--no-session-persistence`. A resumed
  // turn repeats every permission flag above.
  if (options.resumeSessionId) {
    argv.push('--resume', options.resumeSessionId);
    redactedArgv.push('--resume', options.resumeSessionId);
  }

  // The prompt travels on stdin (`--print` reads it there when no positional
  // prompt is given), so a large prompt cannot exceed the argv limit. Live
  // check 2026-11-11 with Claude Code 2.1.322: a stdin prompt with
  // `--output-format json --permission-mode plan --json-schema` returned a
  // `success` result with the expected structured_output.
  return {
    ...invocation({
      executable: options.executable ?? 'claude',
      argv,
      redactedArgv,
      request,
      strategy,
      outputMode: 'stdout_json',
    }),
    permission_profile: {
      mode: permission.mode ?? 'provider_default',
      ...(permission.tools ? { tools: [...permission.tools] } : {}),
      // File paths stay out of diagnostics, as they do in redacted_command.
      ...(permission.allowed_tools.length > 0
        ? {
            allowed_tools: permission.allowed_tools.map((rule) =>
              rule.replace(/^(Read|Edit)\(.*\)$/s, '$1(<path>)'),
            ),
          }
        : {}),
    },
  };
};

export const buildCodexInvocation: ProviderInvocationBuilder = (
  request,
  options = {},
) => {
  const strategy = options.strategy ?? 'prompt_only';
  const lastMessageFile = options.lastMessageFile ?? codexLastMessageFile();
  const resumeSessionId = options.resumeSessionId;
  const argv = [
    'exec',
    ...(resumeSessionId ? ['resume'] : []),
    '--json',
    '--output-last-message',
    lastMessageFile,
  ];
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
    // `codex exec resume` rejects `--sandbox` (codex-cli 0.157.1), so resumed
    // turns reapply the same policy through the config override.
    if (resumeSessionId) {
      argv.push(
        '-c',
        codexConfigOverride('sandbox_mode', request.runtime_policy.sandbox),
      );
    } else {
      argv.push('--sandbox', request.runtime_policy.sandbox);
    }
  }
  const approvalPolicy =
    request.runtime_policy?.approval_policy ??
    (request.runtime_policy?.permission_mode === 'non-interactive'
      ? 'never'
      : undefined);
  if (approvalPolicy) {
    argv.push('-c', codexConfigOverride('approval_policy', approvalPolicy));
  }
  // Resume takes the session positionally; `-` keeps the prompt on stdin.
  if (resumeSessionId) argv.push(resumeSessionId, '-');

  return invocation({
    executable: options.executable ?? 'codex',
    argv,
    request,
    strategy,
    outputMode: 'last_message_file',
    lastMessageFile,
    cleanupLastMessageFile: !options.preserveLastMessageFile,
  });
};

export const buildCursorInvocation: ProviderInvocationBuilder = (
  request,
  options = {},
) => {
  if (options.resumeSessionId) {
    throw new Error(
      'Cursor native resume is not verified for this adapter; use a reconstructed continuation.',
    );
  }
  const strategy =
    options.strategy === 'submit_tool_candidate'
      ? 'prompt_only'
      : (options.strategy ?? 'prompt_only');
  // `--output-format` only takes effect with `--print` (cursor-agent
  // 2026.09.28 help); without it the CLI is not in headless JSON mode.
  // Print mode refuses an untrusted workspace unless `--trust` or `--force`
  // is passed. `--force` also auto-approves every command, so read-only runs
  // use `--trust` with ask mode (read-only tools) and the sandbox instead.
  const argv =
    request.runtime_policy?.permission_mode === 'read-only'
      ? [
          '--print',
          '--output-format',
          'json',
          '--trust',
          '--mode',
          'ask',
          '--sandbox',
          'enabled',
        ]
      : ['--print', '--output-format', 'json', '--force'];

  return invocation({
    executable: options.executable ?? 'cursor-agent',
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
  cleanupLastMessageFile?: boolean;
  stdin?: string;
}): ProviderInvocation {
  return {
    executable: input.executable,
    argv: input.argv,
    stdin: input.stdin ?? input.request.prompt,
    ...(input.request.cwd ? { cwd: input.request.cwd } : {}),
    output_mode: input.outputMode,
    strategy: input.strategy,
    redacted_command: [input.executable, ...(input.redactedArgv ?? input.argv)],
    ...(input.lastMessageFile
      ? {
          last_message_file: input.lastMessageFile,
          cleanup_last_message_file: input.cleanupLastMessageFile ?? true,
        }
      : {}),
    shell: false,
  };
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
