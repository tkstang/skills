export interface CodexBundleResult {
  changed: boolean;
  scriptPath: string;
  supportRoot: string;
  version: string;
}

export function installCodexStopBundle(input: {
  scriptPath: string;
  sourceScriptPath: string;
}): Promise<CodexBundleResult>;

export function removeCodexStopBundle(scriptPath: string): Promise<{
  scriptRemoved: boolean;
  supportRemoved: boolean;
}>;
