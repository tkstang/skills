// Per-provider data for the extended (ACP) tier. Each descriptor is plain
// data that acpAdapter turns into a ProviderAdapter; nothing here branches on
// a provider. Wire facts come from the ACP spike logs (agy 1.5.13, Gemini CLI
// 0.70.0, Droid 1.16.0), recorded in
// .oat/repo/reference/external-plans/2026-11-20-consensus-extended-providers.md.
import type { AcpModeStep } from './client.js';
import type { AcpClassifyOptions } from './transcript.js';

// Where a provider reports the model a session runs, in order of preference.
// `config_model`: the configOptions `model` currentValue (updated by the
// set_config_option response); `current_model_id`: session/new
// models.currentModelId; `usage_models`: the prompt response's
// _meta.quota.model_usage[].model.
export type AcpModelSource =
  | 'config_model'
  | 'current_model_id'
  | 'usage_models';

export interface AcpProviderDescriptor {
  id: string;
  display_name: string;
  executable: string;
  executable_env: string;
  // Credential variables the child inherits.
  credential_env: readonly string[];
  install_hint: string;
  // Numeric floor for `<executable> --version`: the version the wire facts
  // were recorded with.
  minimum_version: string;
  launch_args: readonly string[];
  // How a model is chosen: a session config option confirmed from the
  // set_config_option response, or a launch flag confirmed from the
  // session/new models.currentModelId.
  model:
    | { kind: 'config_option'; config_id: string }
    | { kind: 'launch_flag'; flag: string };
  model_sources: readonly AcpModelSource[];
  // The read-only mode, set and confirmed before the prompt.
  mode: AcpModeStep;
  // When `env` is set in the child environment the adapter authenticates
  // with `method_id` before session/new; otherwise it relies on the agent's
  // saved login. `private_home` launches the agent against a private,
  // temporary settings directory that is removed after the run.
  api_key?: {
    env: string;
    method_id: string;
    private_home?: {
      dir_flag: string;
      app_data_flag: string;
      app_data_name: string;
      settings_files: readonly string[];
      settings: Record<string, unknown>;
    };
  };
  auth_hint: string;
  auth_error_patterns?: readonly RegExp[];
  // Redacted from error text and stderr, beyond the default credential
  // shapes and the credential values.
  redactions?: readonly RegExp[];
  error_text_patterns?: AcpClassifyOptions['errorTextPatterns'];
  // Added to the prompt after the common read-only brief line.
  brief_lines?: readonly string[];
  not_admitted_reason?: string;
}

export const ANTIGRAVITY_DESCRIPTOR: AcpProviderDescriptor = {
  id: 'antigravity',
  display_name: 'Antigravity',
  executable: 'agy',
  executable_env: 'CONSENSUS_ANTIGRAVITY_EXECUTABLE',
  credential_env: ['GEMINI_API_KEY'],
  install_hint:
    'Install Google Antigravity and its `agy` command, then sign in with `agy acp --login` from a desktop terminal.',
  minimum_version: '1.5.13',
  launch_args: ['acp'],
  model: { kind: 'config_option', config_id: 'model' },
  // models.currentModelId joins model and thinking level
  // (gemini-3.8-flash-high) and is not updated by set_config_option.
  model_sources: ['config_model', 'current_model_id'],
  // agy answers set_mode with {} and no echo, so `default` is confirmed by
  // session/new reporting it. Never accept-edits, auto or plan.
  mode: {
    modeId: 'default',
    confirm: { initialState: true, currentModeUpdate: true },
  },
  // Without an explicit authenticate, a --gemini-dir run silently used the
  // desktop login (agy-key-default.jsonl).
  api_key: {
    env: 'GEMINI_API_KEY',
    method_id: 'gemini-api-key',
    private_home: {
      dir_flag: '--gemini-dir',
      app_data_flag: '--app-data-dir',
      app_data_name: 'consensus-agy',
      settings_files: ['antigravity-cli/settings.json', 'config/settings.json'],
      settings: { modelProvider: 'gemini' },
    },
  },
  auth_hint:
    'Sign in with `agy acp --login` from a desktop terminal, or set GEMINI_API_KEY.',
  auth_error_patterns: [/No browser is available/i],
  // A 429 arrives as answer text with end_turn (agy-key2-default.jsonl).
  error_text_patterns: [
    {
      pattern: /Error 429|exceeded your current quota/i,
      code: 'PROVIDER_LIMIT_REACHED',
    },
    { pattern: /agent executor error/i, code: 'PROVIDER_EXIT' },
  ],
  brief_lines: ['Do not use invoke_subagent, swarm, run_workflow or schedule.'],
};

export const GEMINI_DESCRIPTOR: AcpProviderDescriptor = {
  id: 'gemini',
  display_name: 'Gemini CLI',
  executable: 'gemini',
  executable_env: 'CONSENSUS_GEMINI_EXECUTABLE',
  credential_env: ['GEMINI_API_KEY'],
  install_hint:
    'Install Gemini CLI with `npm install -g @google/gemini-cli`, then sign in by running `gemini` once, or set GEMINI_API_KEY.',
  minimum_version: '0.70.0',
  launch_args: ['--acp'],
  // Gemini advertises no configOptions; -m at launch is the only lever.
  model: { kind: 'launch_flag', flag: '-m' },
  model_sources: ['usage_models', 'current_model_id'],
  // Plan mode's only echo is this chunk, sent before the set_mode response.
  mode: {
    modeId: 'plan',
    confirm: { marker: '[MODE_UPDATE] plan', currentModeUpdate: true },
  },
  api_key: { env: 'GEMINI_API_KEY', method_id: 'gemini-api-key' },
  auth_hint:
    'Sign in by running `gemini` once in a terminal, or set GEMINI_API_KEY.',
};

export const DROID_DESCRIPTOR: AcpProviderDescriptor = {
  id: 'droid',
  display_name: 'Droid',
  executable: 'droid',
  executable_env: 'CONSENSUS_DROID_EXECUTABLE',
  credential_env: ['FACTORY_API_KEY'],
  install_hint:
    'Install Factory Droid (https://docs.factory.ai), then sign in by running `droid` in a desktop terminal, or set FACTORY_API_KEY.',
  minimum_version: '1.16.0',
  launch_args: ['exec', '--output-format', 'acp'],
  model: { kind: 'config_option', config_id: 'model' },
  model_sources: ['config_model'],
  // The ACP default is auto-medium, which auto-approves writes. normal is
  // echoed by current_mode_update and the autonomy_level config option.
  mode: {
    modeId: 'normal',
    confirm: { currentModeUpdate: true, configOptionId: 'autonomy_level' },
  },
  api_key: { env: 'FACTORY_API_KEY', method_id: 'factory-api-key' },
  auth_hint:
    'Sign in by running `droid` in a desktop terminal, or set FACTORY_API_KEY.',
  // The auth-required message carries a live device-pairing code.
  redactions: [/(?<=Your code:\s*)[A-Z0-9]{4}-[A-Z0-9]{4}\b/g],
  brief_lines: [
    'Do not use loop, ConnectApp, automation, or cloud/computer tools.',
  ],
};

export const ACP_PROVIDER_DESCRIPTORS: readonly AcpProviderDescriptor[] = [
  ANTIGRAVITY_DESCRIPTOR,
  GEMINI_DESCRIPTOR,
  DROID_DESCRIPTOR,
];
