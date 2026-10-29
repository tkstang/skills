import metadata from '../package.json' with { type: 'json' };

/** Wire/API IDs are stable; unimplemented session operations are not advertised. */
export type CapabilityId =
  | 'toolkit.capabilities.v1'
  | 'cli.help.v1'
  | 'cli.version.v1'
  | 'identity.current.v1'
  | 'sessions.list.v1'
  | 'transcript.read.v1'
  | 'transcript.parse.v1'
  | 'transcript.evidence.codex.v1'
  | 'export.markdown.v1'
  | 'search.v1'
  | 'search.estimate.v1';

export interface Capabilities {
  readonly package: '@tkstang/session-toolkit';
  readonly version: string;
  readonly schema_version: 1;
  readonly node: '>=22.0.0';
  readonly capabilities: readonly CapabilityId[];
  readonly providers: readonly string[];
}

/** Pure discovery: no provider scans, environment reads or network access. */
export function getCapabilities(): Capabilities {
  return {
    package: '@tkstang/session-toolkit',
    version: metadata.version,
    schema_version: 1,
    node: '>=22.0.0',
    capabilities: [
      'toolkit.capabilities.v1',
      'cli.help.v1',
      'cli.version.v1',
      'identity.current.v1',
      'sessions.list.v1',
      'transcript.read.v1',
      'transcript.parse.v1',
      'transcript.evidence.codex.v1',
      'export.markdown.v1',
      'search.v1',
      'search.estimate.v1',
    ],
    providers: ['claude-code', 'codex', 'cursor'],
  };
}

export type Envelope<T> =
  | { readonly ok: true; readonly schema_version: 1; readonly data: T }
  | {
      readonly ok: false;
      readonly schema_version: 1;
      readonly error: {
        readonly code: import('./domain.js').ErrorCode;
        readonly message: string;
        readonly hint: string;
        readonly details?: unknown;
      };
    };
