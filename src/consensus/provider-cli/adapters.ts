import type {
  FirstScopeProviderId,
  ProviderCapabilities,
  ProviderId,
  StructuredOutputStrategy,
} from './types.js';

export interface ProviderAdapter {
  id: FirstScopeProviderId;
  display_name: string;
  executable: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderAdapterRegistry {
  list(): ProviderAdapter[];
  get(id: ProviderId): ProviderAdapter | undefined;
}

export const DEFAULT_PROVIDER_ADAPTERS: readonly ProviderAdapter[] = [
  {
    id: 'claude',
    display_name: 'Claude',
    executable: 'claude',
    capabilities: {
      schema_strategies: ['provider_validated', 'prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: 'effort',
        runtime_policy: {
          permission_modes: ['non-interactive', 'read-only'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  },
  {
    id: 'codex',
    display_name: 'Codex',
    executable: 'codex',
    capabilities: {
      schema_strategies: ['constrained_native', 'prompt_only'],
      output_modes: ['stdout_json'],
      options: {
        model: true,
        effort: 'reasoning_effort',
        runtime_policy: {
          sandboxes: ['read-only', 'workspace-write'],
          approval_policies: ['never', 'on-request'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  },
  {
    id: 'cursor',
    display_name: 'Cursor',
    executable: 'cursor-agent',
    capabilities: {
      schema_strategies: ['prompt_only', 'submit_tool_candidate'],
      output_modes: ['stdout_json'],
      options: {
        model: false,
        effort: null,
        runtime_policy: {
          permission_modes: ['non-interactive'],
          env_allowlist: true,
        },
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false,
    },
  },
];

export function providerRegistry(
  adapters: readonly ProviderAdapter[] = DEFAULT_PROVIDER_ADAPTERS,
): ProviderAdapterRegistry {
  const byId = new Map<ProviderId, ProviderAdapter>();
  for (const adapter of adapters) byId.set(adapter.id, adapter);

  return {
    list() {
      return [...adapters];
    },
    get(id) {
      return byId.get(id);
    },
  };
}

export function defaultSchemaStrategy(
  adapter: ProviderAdapter,
): StructuredOutputStrategy {
  return (
    adapter.capabilities.schema_strategies.find(
      (strategy) => strategy !== 'submit_tool_candidate',
    ) ?? 'prompt_only'
  );
}
