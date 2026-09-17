#!/usr/bin/env node
// GENERATED skill payload for consensus-review.

// src/skills/consensus-review/src/review.ts
import { pathToFileURL } from "node:url";

// src/skills/consensus-review/src/run.ts
import path6 from "node:path";

// src/plugins/consensus/provider-cli/invocation.ts
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
function buildProviderInvocation(adapter, request, options = {}) {
  return adapter.buildInvocation(request, {
    strategy: options.strategy ?? defaultStrategy(adapter),
    inlineJsonSchema: options.inlineJsonSchema,
    lastMessageFile: options.lastMessageFile,
    preserveLastMessageFile: options.preserveLastMessageFile
  });
}
var buildClaudeInvocation = (request, options = {}) => {
  const strategy = options.strategy ?? "prompt_only";
  const argv = ["--print", "--output-format", "json"];
  const redactedArgv = ["--print", "--output-format", "json"];
  if (strategy === "provider_validated") {
    if (!options.inlineJsonSchema) {
      throw new Error(
        "Claude provider-validated invocation requires an inline JSON schema."
      );
    }
    argv.push("--json-schema", options.inlineJsonSchema);
    redactedArgv.push("--json-schema", "<inline-json-schema>");
  }
  if (request.model) {
    argv.push("--model", request.model);
    redactedArgv.push("--model", request.model);
  }
  if (request.effort) {
    argv.push("--effort", request.effort);
    redactedArgv.push("--effort", request.effort);
  }
  const claudePermissionMode = mapClaudePermissionMode(
    request.runtime_policy?.permission_mode
  );
  if (claudePermissionMode) {
    argv.push("--permission-mode", claudePermissionMode);
    redactedArgv.push("--permission-mode", claudePermissionMode);
  }
  argv.push(request.prompt);
  redactedArgv.push("<prompt>");
  return invocation({
    executable: "claude",
    argv,
    redactedArgv,
    request,
    strategy,
    outputMode: "stdout_json",
    stdin: ""
  });
};
var buildCodexInvocation = (request, options = {}) => {
  const strategy = options.strategy ?? "prompt_only";
  const lastMessageFile = options.lastMessageFile ?? codexLastMessageFile();
  const argv = ["exec", "--json", "--output-last-message", lastMessageFile];
  if (strategy === "constrained_native") {
    argv.push("--output-schema", request.schema_path);
  }
  if (request.model) argv.push("--model", request.model);
  if (request.effort) {
    argv.push(
      "-c",
      codexConfigOverride("model_reasoning_effort", request.effort)
    );
  }
  if (request.runtime_policy?.sandbox) {
    argv.push("--sandbox", request.runtime_policy.sandbox);
  }
  const approvalPolicy = request.runtime_policy?.approval_policy ?? (request.runtime_policy?.permission_mode === "non-interactive" ? "never" : void 0);
  if (approvalPolicy) {
    argv.push("-c", codexConfigOverride("approval_policy", approvalPolicy));
  }
  return invocation({
    executable: "codex",
    argv,
    request,
    strategy,
    outputMode: "last_message_file",
    lastMessageFile,
    cleanupLastMessageFile: !options.preserveLastMessageFile
  });
};
var buildCursorInvocation = (request, options = {}) => {
  const strategy = options.strategy === "submit_tool_candidate" ? "prompt_only" : options.strategy ?? "prompt_only";
  const argv = ["--output-format", "json", "--force"];
  return invocation({
    executable: "cursor-agent",
    argv,
    request,
    strategy,
    outputMode: "stdout_json"
  });
};
function invocation(input) {
  return {
    executable: input.executable,
    argv: input.argv,
    stdin: input.stdin ?? input.request.prompt,
    ...input.request.cwd ? { cwd: input.request.cwd } : {},
    output_mode: input.outputMode,
    strategy: input.strategy,
    redacted_command: [input.executable, ...input.redactedArgv ?? input.argv],
    ...input.lastMessageFile ? {
      last_message_file: input.lastMessageFile,
      cleanup_last_message_file: input.cleanupLastMessageFile ?? true
    } : {},
    shell: false
  };
}
function mapClaudePermissionMode(permissionMode) {
  if (!permissionMode || permissionMode === "non-interactive") {
    return void 0;
  }
  if (permissionMode === "read-only") {
    return "plan";
  }
  return permissionMode;
}
function codexConfigOverride(key, value) {
  return `${key}=${JSON.stringify(value)}`;
}
function codexLastMessageFile() {
  return path.join(
    tmpdir(),
    `consensus-codex-last-message-${randomUUID()}.txt`
  );
}
function defaultStrategy(adapter) {
  return adapter.capabilities.schema_strategies.find(
    (strategy) => strategy !== "submit_tool_candidate"
  ) ?? "prompt_only";
}

// src/plugins/consensus/provider-cli/subprocess.ts
import { spawn } from "node:child_process";
import { open, rm } from "node:fs/promises";
var DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024 * 10;
var DEFAULT_TIMEOUT_SEC = 300;
var DEFAULT_TERMINATION_GRACE_MS = 250;
var DEFAULT_FINAL_RESOLUTION_MS = 1e3;
function isReliableExternalInterrupt(input) {
  return input.code === "PROVIDER_EXIT" && input.signal !== null && input.exit_code === null;
}
function runProviderSubprocess(invocation2, options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutSec = options.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const terminationGraceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
  const finalResolutionMs = options.finalResolutionMs ?? DEFAULT_FINAL_RESOLUTION_MS;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputCaptureClosed = false;
    let exitCode = null;
    let exitSignal = null;
    let settled = false;
    let terminal;
    const child = spawn(invocation2.executable, invocation2.argv, {
      cwd: invocation2.cwd,
      env: options.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let killEscalation;
    let finalResolution;
    const timeout = setTimeout(() => {
      terminate("timeout");
    }, timeoutSec * 1e3);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("error", () => {
    });
    child.stderr.on("error", () => {
    });
    child.stdout.on("data", (chunk) => {
      captureOutput("stdout", chunk);
    });
    child.stderr.on("data", (chunk) => {
      captureOutput("stderr", chunk);
    });
    child.on("error", () => {
      terminal = terminal ?? "spawn_error";
      void finish();
    });
    child.on("close", (exitCode2, signal) => {
      void finish(exitCode2, signal);
    });
    child.stdin.on("error", () => {
    });
    child.stdin.end(invocation2.stdin);
    function terminate(reason) {
      terminal = terminal ?? reason;
      if (reason === "output_cap") {
        closeOutputCapture();
      }
      child.kill("SIGTERM");
      if (!killEscalation) {
        killEscalation = setTimeout(() => {
          child.kill("SIGKILL");
          finalResolution = setTimeout(() => {
            void finish(null, "SIGKILL");
          }, finalResolutionMs);
        }, terminationGraceMs);
      }
    }
    function captureOutput(stream, chunk) {
      if (outputCaptureClosed) return;
      const remaining = maxOutputBytes - stdoutBytes - stderrBytes;
      if (remaining <= 0) {
        terminate("output_cap");
        return;
      }
      const chunkBytes = Buffer.byteLength(chunk);
      if (chunkBytes <= remaining) {
        appendOutput(stream, chunk, chunkBytes);
        return;
      }
      const retained = takeUtf8Prefix(chunk, remaining);
      if (retained.bytes > 0) {
        appendOutput(stream, retained.text, retained.bytes);
      }
      terminate("output_cap");
    }
    function appendOutput(stream, chunk, chunkBytes) {
      if (stream === "stdout") {
        stdout += chunk;
        stdoutBytes += chunkBytes;
      } else {
        stderr += chunk;
        stderrBytes += chunkBytes;
      }
    }
    function closeOutputCapture() {
      if (outputCaptureClosed) return;
      outputCaptureClosed = true;
      child.stdout.destroy();
      child.stderr.destroy();
    }
    async function finish(closeExitCode = exitCode, closeSignal = exitSignal) {
      if (settled) return;
      settled = true;
      exitCode = closeExitCode;
      exitSignal = closeSignal;
      clearTimeout(timeout);
      if (killEscalation) clearTimeout(killEscalation);
      if (finalResolution) clearTimeout(finalResolution);
      const diagnostics = diagnosticsFor({
        invocation: invocation2,
        stdoutBytes,
        stderrBytes,
        maxOutputBytes,
        timeoutSec,
        exitCode,
        signal: exitSignal
      });
      if (terminal === "spawn_error") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_MISSING",
            message: `Provider executable not found: ${invocation2.executable}`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (terminal === "timeout") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_TIMEOUT",
            message: `Provider subprocess timed out after ${timeoutSec} seconds.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (terminal === "output_cap") {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_OUTPUT_CAP_EXCEEDED",
            message: `Provider subprocess exceeded output cap of ${maxOutputBytes} bytes.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      if (exitCode !== 0) {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_EXIT",
            message: `Provider subprocess exited with code ${exitCode ?? "null"}.`,
            retryable: true,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      const lastMessage = await readLastMessage(invocation2, maxOutputBytes);
      if (lastMessage.tooLarge) {
        await cleanupInvocationFiles(invocation2);
        resolve(
          failure({
            code: "PROVIDER_OUTPUT_CAP_EXCEEDED",
            message: `Provider last-message capture exceeded output cap of ${maxOutputBytes} bytes.`,
            retryable: false,
            stdout,
            stderr,
            exitCode,
            signal: exitSignal,
            diagnostics
          })
        );
        return;
      }
      await cleanupInvocationFiles(invocation2);
      resolve({
        ok: true,
        stdout,
        stderr,
        ...lastMessage.contents !== void 0 ? { last_message: lastMessage.contents } : {},
        exit_code: exitCode,
        signal: exitSignal,
        diagnostics: lastMessage.warning ? {
          ...diagnostics,
          warnings: [...diagnostics.warnings ?? [], lastMessage.warning]
        } : diagnostics
      });
    }
  });
}
async function readLastMessage(invocation2, maxBytes = DEFAULT_MAX_OUTPUT_BYTES) {
  if (!invocation2.last_message_file) return {};
  const result = await readBoundedRegularFile(
    invocation2.last_message_file,
    maxBytes
  );
  if (result.ok) return { contents: result.contents };
  if (result.reason === "too_large") return { tooLarge: true };
  return {
    warning: `Could not read provider last-message file: ${result.message}`
  };
}
async function cleanupInvocationFiles(invocation2) {
  if (!invocation2.last_message_file || invocation2.cleanup_last_message_file === false) {
    return;
  }
  try {
    await rm(invocation2.last_message_file, { force: true });
  } catch {
  }
}
async function readBoundedRegularFile(filePath, maxBytes, options = {}) {
  let handle;
  try {
    handle = await open(filePath, "r");
    const info = await handle.stat();
    if (!info.isFile()) {
      return {
        ok: false,
        reason: "not_regular",
        message: "capture is not a regular file"
      };
    }
    if (info.size > maxBytes) {
      return {
        ok: false,
        reason: "too_large",
        message: `capture exceeds ${maxBytes} bytes`
      };
    }
    await options.afterStat?.();
    const chunks = [];
    let total = 0;
    let position = 0;
    while (total <= maxBytes) {
      const remaining = maxBytes + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position
      );
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
      position += bytesRead;
    }
    if (total > maxBytes) {
      return {
        ok: false,
        reason: "too_large",
        message: `capture exceeds ${maxBytes} bytes`
      };
    }
    return {
      ok: true,
      contents: Buffer.concat(chunks, total).toString("utf8"),
      bytes: total
    };
  } catch (error) {
    return {
      ok: false,
      reason: "read_failed",
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await handle?.close();
  }
}
function takeUtf8Prefix(input, maxBytes) {
  let bytes = 0;
  let text = "";
  for (const character of input) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    text += character;
    bytes += characterBytes;
  }
  return { text, bytes };
}
function diagnosticsFor(input) {
  return {
    strategy_used: input.invocation.strategy,
    output_mode: input.invocation.output_mode,
    redacted_command: input.invocation.redacted_command,
    provider_exit_code: input.exitCode,
    provider_signal: input.signal,
    output_bytes: {
      stdout: input.stdoutBytes,
      stderr: input.stderrBytes,
      max: input.maxOutputBytes
    },
    timeout_sec: input.timeoutSec
  };
}
function failure(input) {
  return {
    ok: false,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    stdout: input.stdout,
    stderr: input.stderr,
    exit_code: input.exitCode,
    signal: input.signal,
    diagnostics: input.diagnostics
  };
}

// src/plugins/consensus/provider-cli/adapters.ts
var COMMON_AUTH_REQUIRED_PATTERNS = [
  /auth(?:entication)? required/i,
  /not logged in/i,
  /login required/i,
  /keychain.*locked/i
];
var COMMON_UNAVAILABLE_PATTERNS = [
  /unsupported platform/i,
  /not configured/i
];
var COMMON_UNSUPPORTED_OPTION_PATTERNS = [
  /unknown (?:option|flag|argument)/i,
  /unrecognized (?:option|flag|argument)/i,
  /unsupported (?:option|flag|argument)/i,
  /invalid (?:option|flag|argument)/i
];
var COMMON_TRANSIENT_EXIT_PATTERNS = [
  /\b429\b/i,
  /rate limit/i,
  /temporar(?:y|ily) unavailable/i,
  /try again/i,
  /econnreset/i,
  /etimedout/i
];
var CLAUDE_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: Claude Code error reference documents this exact repeated 529
  // overload message as temporary capacity exhaustion:
  // https://code.claude.com/docs/en/errors
  /API Error: Repeated 529 Overloaded errors/i
];
var CODEX_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: installed codex-cli 0.142.5 binary strings include these
  // rate-limit and overload messages in provider-facing error paths.
  /rate limiter has requested a/i,
  /failed to fetch codex rate limits/i,
  /unknown rate limit reached type/i,
  /dropping overload response for connection/i,
  /try again at/i
];
var CURSOR_TRANSIENT_EXIT_PATTERNS = [
  // Evidence: installed cursor-agent 2026.07.01 bundle contains these
  // connection/session terminal reasons and network errors.
  /connection_timeout/i,
  /stream_error/i,
  /session_error/i,
  /session_aborted/i,
  /network error/i
];
var DEFAULT_PROVIDER_ADAPTERS = [
  {
    id: "claude",
    display_name: "Claude",
    executable: "claude",
    buildInvocation: buildClaudeInvocation,
    classifyRunFailure: defaultRunFailureClassifier({
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CLAUDE_TRANSIENT_EXIT_PATTERNS
      ]
    }),
    probe: {
      version_args: ["--version"],
      // Release verification established the provider-validated run surface at
      // Claude Code 2.1.185 (RELEASING.md).
      minimum_version: "2.1.185",
      capabilities: {
        run: {
          args: ["--help"],
          required_output_patterns: [/--print\b/, /--output-format\b/]
        }
      },
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS
    },
    capabilities: {
      schema_strategies: ["provider_validated", "prompt_only"],
      output_modes: ["stdout_json"],
      options: {
        model: true,
        effort: "effort",
        runtime_policy: {
          permission_modes: ["non-interactive", "read-only"],
          env_allowlist: true
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false
    }
  },
  {
    id: "codex",
    display_name: "Codex",
    executable: "codex",
    buildInvocation: buildCodexInvocation,
    classifyRunFailure: defaultRunFailureClassifier({
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CODEX_TRANSIENT_EXIT_PATTERNS
      ]
    }),
    probe: {
      version_args: ["--version"],
      // Release verification established the provider-validated run surface at
      // Codex CLI 0.139.0 (RELEASING.md).
      minimum_version: "0.139.0",
      capabilities: {
        run: {
          args: ["exec", "--help"],
          required_output_patterns: [
            /--json\b/,
            /--output-last-message\b/,
            /--output-schema\b/
          ]
        }
      },
      auth_required_patterns: COMMON_AUTH_REQUIRED_PATTERNS,
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS
    },
    capabilities: {
      schema_strategies: ["constrained_native", "prompt_only"],
      output_modes: ["last_message_file"],
      options: {
        model: true,
        effort: "reasoning_effort",
        runtime_policy: {
          permission_modes: ["non-interactive"],
          sandboxes: ["read-only", "workspace-write"],
          approval_policies: ["never", "on-request"],
          env_allowlist: true
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false
    }
  },
  {
    id: "cursor",
    display_name: "Cursor",
    executable: "cursor-agent",
    buildInvocation: buildCursorInvocation,
    classifyRunFailure: defaultRunFailureClassifier({
      auth_required_patterns: [
        ...COMMON_AUTH_REQUIRED_PATTERNS,
        /credential.*locked/i
      ],
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS,
      unsupported_option_patterns: COMMON_UNSUPPORTED_OPTION_PATTERNS,
      transient_exit_patterns: [
        ...COMMON_TRANSIENT_EXIT_PATTERNS,
        ...CURSOR_TRANSIENT_EXIT_PATTERNS
      ]
    }),
    probe: {
      version_args: ["--version"],
      // Release verification established the prompt-only run surface at the
      // 2026.06.19 Cursor agent build (RELEASING.md).
      minimum_version: "2026.6.19",
      capabilities: {
        run: {
          args: ["--help"],
          required_output_patterns: [/--output-format\b/, /--force\b/]
        }
      },
      auth_required_patterns: [
        ...COMMON_AUTH_REQUIRED_PATTERNS,
        /credential.*locked/i
      ],
      unavailable_patterns: COMMON_UNAVAILABLE_PATTERNS
    },
    capabilities: {
      schema_strategies: ["prompt_only", "submit_tool_candidate"],
      output_modes: ["stdout_json"],
      options: {
        model: false,
        effort: null,
        runtime_policy: {
          permission_modes: ["non-interactive"],
          env_allowlist: true
        }
      },
      supports_submit_tool: false,
      supports_same_host_subprocess: true,
      supports_host_native_dispatch: false
    }
  }
];
function providerRegistry(adapters = DEFAULT_PROVIDER_ADAPTERS) {
  const byId = /* @__PURE__ */ new Map();
  for (const adapter of adapters) byId.set(adapter.id, adapter);
  return {
    list() {
      return [...adapters];
    },
    get(id) {
      return byId.get(id);
    }
  };
}
function defaultRunFailureClassifier(patterns) {
  return (failure2) => {
    if (failure2.code !== "PROVIDER_EXIT") {
      return {
        code: failure2.code,
        message: failure2.message,
        retryable: failure2.retryable,
        terminal_reason: terminalReasonForNonExitFailure(failure2.code),
        exit_classification: "terminal"
      };
    }
    const output = `${failure2.stdout}
${failure2.stderr}
${failure2.message}`;
    const outputLine = firstNonEmptyLine(output);
    if (isReliableExternalInterrupt(failure2)) {
      return {
        code: "PROVIDER_EXIT",
        message: `Provider subprocess was interrupted by signal ${failure2.signal}.`,
        retryable: true,
        terminal_reason: "provider_exit_interrupted",
        exit_classification: "interrupted"
      };
    }
    if (matchesAny(output, patterns.auth_required_patterns)) {
      return {
        code: "PROVIDER_AUTH_REQUIRED",
        message: outputLine ?? "Provider authentication is required.",
        retryable: false,
        terminal_reason: "provider_auth_required",
        exit_classification: "terminal"
      };
    }
    if (matchesAny(output, patterns.unsupported_option_patterns)) {
      return {
        code: "PROVIDER_UNSUPPORTED_OPTION",
        message: outputLine ?? "Provider rejected an unsupported option.",
        retryable: false,
        terminal_reason: "provider_unsupported_option",
        exit_classification: "terminal"
      };
    }
    if (matchesAny(output, patterns.unavailable_patterns)) {
      return {
        code: "PROVIDER_EXIT",
        message: outputLine ?? failure2.message,
        retryable: false,
        terminal_reason: "provider_unavailable_exit",
        exit_classification: "terminal"
      };
    }
    if (matchesAny(output, patterns.transient_exit_patterns)) {
      return {
        code: "PROVIDER_EXIT",
        message: outputLine ?? failure2.message,
        retryable: true,
        terminal_reason: "provider_exit_transient",
        exit_classification: "transient"
      };
    }
    return {
      code: "PROVIDER_EXIT",
      message: outputLine ?? failure2.message,
      retryable: false,
      terminal_reason: "provider_exit_terminal",
      exit_classification: "unknown"
    };
  };
}
function terminalReasonForNonExitFailure(code) {
  if (code === "PROVIDER_MISSING") return "provider_missing";
  if (code === "PROVIDER_TIMEOUT") return "provider_timeout";
  return "output_cap_exceeded";
}
function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}
function firstNonEmptyLine(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}

// src/plugins/consensus/provider-cli/host-guard.ts
function resolveExplicitHostContext(input) {
  const detected = detectedHostRuntimes(input.env);
  const declaredParent = input.env.CONSENSUS_PARENT_HOST;
  if (declaredParent !== void 0 && declaredParent !== "claude" && declaredParent !== "codex" && declaredParent !== "cursor" || detected.size > 1 || detected.size === 1 && !detected.has(input.runtime)) {
    return {
      ok: false,
      reason: "contradictory_host",
      message: `Explicit host ${input.runtime} contradicts detected host evidence.`
    };
  }
  if (detected.size === 0) {
    return {
      ok: false,
      reason: "unknown_host",
      message: `Could not verify explicit host ${input.runtime} from runtime evidence.`
    };
  }
  return {
    ok: true,
    context: {
      runtime: input.runtime,
      cwd: input.cwd,
      run_id: input.env.CONSENSUS_RUN_ID ?? "local",
      depth: parseNonNegativeInteger(input.env.CONSENSUS_DEPTH) ?? 0,
      max_depth: input.maxDepth
    }
  };
}
function buildChildHostEnv(context) {
  return {
    CONSENSUS_RUN_ID: context.run_id,
    CONSENSUS_PARENT_HOST: context.runtime,
    CONSENSUS_DEPTH: String(context.depth + 1)
  };
}
function evaluateHostGuard(input) {
  const { host, provider } = input;
  if (!host || host.runtime === "unknown") {
    return allowed("unknown", "none");
  }
  if (host.runtime !== provider) {
    const crossDepth = host.depth + 1;
    if (crossDepth > host.max_depth) {
      return {
        allowed: false,
        code: "HOST_RECURSION_BLOCKED",
        message: `Blocked cross-provider peer spawn (${host.runtime}\u2192${provider}) at depth ${crossDepth}; max_depth is ${host.max_depth}.`,
        host_relation: "different_host",
        guard: "blocked",
        diagnostics: {
          host_relation: "different_host",
          guard: "blocked",
          warnings: [
            `HOST_RECURSION_BLOCKED: cross-provider ${host.runtime}\u2192${provider} peer would exceed max_depth ${host.max_depth}`
          ]
        }
      };
    }
    return allowed(
      "different_host",
      "subprocess_isolated",
      buildChildHostEnv(host)
    );
  }
  const childDepth = host.depth + 1;
  if (childDepth > host.max_depth) {
    return {
      allowed: false,
      code: "HOST_RECURSION_BLOCKED",
      message: `Blocked recursive ${provider} peer spawn at depth ${childDepth}; max_depth is ${host.max_depth}.`,
      host_relation: "same_host",
      guard: "blocked",
      diagnostics: {
        host_relation: "same_host",
        guard: "blocked",
        warnings: [
          `HOST_RECURSION_BLOCKED: ${provider} peer would exceed max_depth ${host.max_depth}`
        ]
      }
    };
  }
  return allowed("same_host", "subprocess_isolated", buildChildHostEnv(host));
}
function allowed(hostRelation, guard, childEnv) {
  return {
    allowed: true,
    host_relation: hostRelation,
    guard,
    ...childEnv ? { child_env: childEnv } : {},
    diagnostics: {
      host_relation: hostRelation,
      guard
    }
  };
}
function parseNonNegativeInteger(value) {
  if (value === void 0 || !/^\d+$/.test(value)) return void 0;
  return Number(value);
}
function detectedHostRuntimes(env) {
  const detected = /* @__PURE__ */ new Set();
  if (env.CONSENSUS_PARENT_HOST === "claude" || env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_CODE_SESSION_ID || env.CLAUDE_SESSION_ID) {
    detected.add("claude");
  }
  if (env.CONSENSUS_PARENT_HOST === "codex" || env.CODEX_SESSION_ID || env.CODEX_SANDBOX || env.OPENAI_CODEX_SESSION_ID) {
    detected.add("codex");
  }
  if (env.CONSENSUS_PARENT_HOST === "cursor" || env.CURSOR_TRACE_ID || env.CURSOR_AGENT || env.CURSOR_SESSION_ID || env.CURSOR) {
    detected.add("cursor");
  }
  return detected;
}

// src/plugins/consensus/provider-cli/probe.ts
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path2 from "node:path";

// src/plugins/consensus/provider-cli/runtime-policy.ts
var DEFAULT_RUNTIME_POLICY = {
  permission_mode: "non-interactive"
};
var BASE_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG"
];
var PROVIDER_ENV_ALLOWLIST = [
  ["claude", ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"]],
  ["codex", ["OPENAI_API_KEY"]],
  ["cursor", ["CURSOR_API_KEY"]]
];
function validateProviderOptions(request, capabilities) {
  if (request.model && !capabilities.options.model) {
    return unsupported("model", "Provider does not support model selection.");
  }
  if (request.effort && capabilities.options.effort === null) {
    return unsupported("effort", "Provider does not support effort selection.");
  }
  const policy = defaultRuntimePolicy(request.runtime_policy);
  const runtimeCapabilities = capabilities.options.runtime_policy;
  const permissionResult = validateOptionValue(
    "runtime_policy.permission_mode",
    policy.permission_mode,
    runtimeCapabilities.permission_modes
  );
  if (permissionResult) return permissionResult;
  const sandboxResult = validateOptionValue(
    "runtime_policy.sandbox",
    policy.sandbox,
    runtimeCapabilities.sandboxes
  );
  if (sandboxResult) return sandboxResult;
  const approvalResult = validateOptionValue(
    "runtime_policy.approval_policy",
    policy.approval_policy,
    runtimeCapabilities.approval_policies
  );
  if (approvalResult) return approvalResult;
  if (policy.env_allowlist && policy.env_allowlist.length > 0 && !runtimeCapabilities.env_allowlist) {
    return unsupported(
      "runtime_policy.env_allowlist",
      "Provider does not support child environment allowlist extension."
    );
  }
  return { ok: true };
}
function defaultRuntimePolicy(policy = {}) {
  return {
    permission_mode: policy.permission_mode ?? DEFAULT_RUNTIME_POLICY.permission_mode,
    ...policy.sandbox ? { sandbox: policy.sandbox } : {},
    ...policy.approval_policy ? { approval_policy: policy.approval_policy } : {},
    ...policy.env_allowlist ? { env_allowlist: policy.env_allowlist } : {}
  };
}
function buildChildEnvironment({
  parentEnv,
  request,
  hostEnv
}) {
  const allowedNames = /* @__PURE__ */ new Set([
    ...BASE_ENV_ALLOWLIST,
    ...providerEnvAllowlist(request.provider),
    ...request.runtime_policy?.env_allowlist ?? []
  ]);
  const childEnv = {};
  for (const name of allowedNames) {
    const value = parentEnv[name];
    if (value !== void 0) childEnv[name] = value;
  }
  return {
    ...childEnv,
    ...hostEnv
  };
}
function buildProviderProbeEnvironment({
  parentEnv,
  provider
}) {
  const allowedNames = /* @__PURE__ */ new Set([
    ...BASE_ENV_ALLOWLIST,
    ...providerEnvAllowlist(provider)
  ]);
  const probeEnv = {};
  for (const name of allowedNames) {
    const value = parentEnv[name];
    if (value !== void 0) probeEnv[name] = value;
  }
  return probeEnv;
}
function providerEnvAllowlist(provider) {
  return PROVIDER_ENV_ALLOWLIST.find(([id]) => id === provider)?.[1] ?? [];
}
function validateOptionValue(option, value, supportedValues) {
  if (!value) return void 0;
  if (supportedValues?.includes(value)) return void 0;
  return unsupported(
    option,
    supportedValues ? `Unsupported ${option}: ${value}.` : `Provider does not support ${option}.`
  );
}
function unsupported(option, message) {
  return {
    ok: false,
    code: "PROVIDER_UNSUPPORTED_OPTION",
    option,
    message
  };
}

// src/plugins/consensus/provider-cli/probe.ts
var DEFAULT_PROBE_TIMEOUT_SEC = 10;
var DEFAULT_PROBE_MAX_OUTPUT_BYTES = 64 * 1024;
async function probeProviderRegistry({
  registry,
  runner,
  provider,
  requiredCapabilities
}) {
  const adapters = provider ? [registry.get(provider)].filter(
    (adapter) => adapter !== void 0
  ) : registry.list();
  return Promise.all(
    adapters.map(
      (adapter) => probeProviderReadiness(adapter, { runner, requiredCapabilities })
    )
  );
}
async function probeProviderReadiness(adapter, options) {
  const executable = await options.runner.findExecutable(adapter.executable);
  if (!executable) {
    return providerEntry(adapter, "missing", {
      warnings: [
        `PROVIDER_MISSING: executable not found for ${adapter.id} (${adapter.executable})`
      ]
    });
  }
  const result = await options.runner.run(
    adapter.executable,
    adapter.probe.version_args,
    adapter.id
  );
  const probeFailure = probeFailureEntry(adapter, executable, result);
  if (probeFailure) return probeFailure;
  const output = `${result.stdout}
${result.stderr}`;
  if (matchesAny2(output, adapter.probe.auth_required_patterns)) {
    return providerEntry(adapter, "auth_required", {
      executable,
      warnings: [`PROVIDER_AUTH_REQUIRED: ${firstNonEmptyLine2(output)}`]
    });
  }
  if (result.code !== 0 || matchesAny2(output, adapter.probe.unavailable_patterns)) {
    return providerEntry(adapter, "unavailable", {
      executable,
      warnings: [`PROVIDER_UNAVAILABLE: ${firstNonEmptyLine2(output)}`]
    });
  }
  const detectedVersion = parseNumericVersion(output);
  const minimumVersion = parseNumericVersion(adapter.probe.minimum_version);
  if (!detectedVersion || !minimumVersion) {
    return providerEntry(adapter, "unavailable", {
      executable,
      version: firstNonEmptyLine2(output),
      warnings: [
        `PROVIDER_VERSION_UNPARSEABLE: could not establish ${adapter.id} compatibility from version output`
      ]
    });
  }
  if (compareNumericVersions(detectedVersion, minimumVersion) < 0) {
    return providerEntry(adapter, "unavailable", {
      executable,
      version: firstNonEmptyLine2(output),
      warnings: [
        `PROVIDER_VERSION_UNSUPPORTED: ${adapter.id} ${formatNumericVersion(detectedVersion)} is below required ${adapter.probe.minimum_version}`
      ]
    });
  }
  for (const capability of options.requiredCapabilities ?? []) {
    const definition = adapter.probe.capabilities[capability];
    const capabilityResult = await options.runner.run(
      adapter.executable,
      definition.args,
      adapter.id
    );
    const capabilityFailure = probeFailureEntry(
      adapter,
      executable,
      capabilityResult
    );
    if (capabilityFailure) return capabilityFailure;
    const capabilityOutput = `${capabilityResult.stdout}
${capabilityResult.stderr}`;
    if (capabilityResult.code !== 0 || !definition.required_output_patterns.every(
      (pattern) => pattern.test(capabilityOutput)
    )) {
      return providerEntry(adapter, "unavailable", {
        executable,
        version: firstNonEmptyLine2(output),
        warnings: [
          `PROVIDER_CAPABILITY_MISSING: ${adapter.id} does not expose required local capability ${capability}`
        ]
      });
    }
  }
  return providerEntry(adapter, "ready", {
    executable,
    version: firstNonEmptyLine2(output)
  });
}
function nodeProbeCommandRunner(env = process.env, options = {}) {
  return {
    findExecutable(command) {
      return findExecutable(command, env);
    },
    run(command, args, provider) {
      return runProbeCommand(
        command,
        args,
        buildProviderProbeEnvironment({ parentEnv: env, provider }),
        options
      );
    }
  };
}
async function findExecutable(command, env) {
  if (command.includes(path2.sep)) {
    return canExecute(command).then((ok) => ok ? command : void 0);
  }
  const pathValue = env.PATH ?? "";
  for (const searchPath of pathValue.split(path2.delimiter)) {
    if (!searchPath) continue;
    const candidate = path2.join(searchPath, command);
    if (await canExecute(candidate)) return candidate;
  }
  return void 0;
}
async function canExecute(filePath) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function runProbeCommand(command, args, env, options) {
  const subprocessOptions = {
    env,
    timeoutSec: options.timeoutSec ?? DEFAULT_PROBE_TIMEOUT_SEC,
    maxOutputBytes: options.maxOutputBytes ?? DEFAULT_PROBE_MAX_OUTPUT_BYTES,
    ...options.terminationGraceMs !== void 0 ? { terminationGraceMs: options.terminationGraceMs } : {},
    ...options.finalResolutionMs !== void 0 ? { finalResolutionMs: options.finalResolutionMs } : {}
  };
  return runProviderSubprocess(
    {
      executable: command,
      argv: [...args],
      stdin: "",
      output_mode: "stdout_json",
      strategy: "prompt_only",
      redacted_command: [command, ...args],
      shell: false
    },
    subprocessOptions
  ).then((result) => ({
    code: result.exit_code,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    ...result.ok ? {} : { failure_code: result.code },
    diagnostics: result.diagnostics
  }));
}
function probeFailureEntry(adapter, executable, result) {
  if (!result.failure_code) return void 0;
  if (result.failure_code === "PROVIDER_MISSING") {
    return providerEntry(adapter, "missing", {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_MISSING: executable failed to start for ${adapter.id}`
      ]
    });
  }
  if (result.failure_code === "PROVIDER_TIMEOUT") {
    return providerEntry(adapter, "unavailable", {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_TIMEOUT: readiness probe timed out after ${result.diagnostics?.timeout_sec ?? "the configured"} seconds`
      ]
    });
  }
  if (result.failure_code === "PROVIDER_OUTPUT_CAP_EXCEEDED") {
    return providerEntry(adapter, "unavailable", {
      executable,
      diagnostics: result.diagnostics,
      warnings: [
        `PROVIDER_OUTPUT_CAP_EXCEEDED: readiness probe exceeded output cap of ${result.diagnostics?.output_bytes?.max ?? "the configured limit"} bytes`
      ]
    });
  }
  return void 0;
}
function providerEntry(adapter, status, options = {}) {
  const diagnostics = mergeProviderDiagnostics(
    options.diagnostics,
    options.warnings
  );
  return {
    id: adapter.id,
    status,
    capabilities: adapter.capabilities,
    ...options.executable ? { executable: options.executable } : {},
    ...options.version ? { version: options.version } : {},
    ...diagnostics ? { diagnostics } : {}
  };
}
function mergeProviderDiagnostics(diagnostics, warnings) {
  if (!diagnostics && !warnings) return void 0;
  const mergedWarnings = [
    ...diagnostics?.warnings ?? [],
    ...warnings ?? []
  ];
  return {
    ...diagnostics,
    ...mergedWarnings.length > 0 ? { warnings: mergedWarnings } : {}
  };
}
function matchesAny2(value, patterns) {
  return patterns?.some((pattern) => pattern.test(value)) ?? false;
}
function firstNonEmptyLine2(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}
function parseNumericVersion(value) {
  const match = value.match(/\b(\d+(?:\.\d+){2,})\b/);
  if (!match) return void 0;
  return match[1].split(".").map(Number);
}
function compareNumericVersions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}
function formatNumericVersion(version) {
  return version.join(".");
}

// src/plugins/consensus/provider-cli/structured-output.ts
import { readFile, rm as rm2 } from "node:fs/promises";
import path4 from "node:path";
import { fileURLToPath } from "node:url";

// src/plugins/consensus/provider-cli/envelope.ts
function successEnvelope(input) {
  const envelope = {
    schema_version: "v1",
    ok: true,
    provider: input.provider,
    args: input.args,
    stdout: input.stdout,
    json: input.json,
    attempts: buildAttemptSummary(input.attempts, false)
  };
  if (input.stderr !== void 0) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;
  return envelope;
}
function failureEnvelope(input) {
  const envelope = {
    schema_version: "v1",
    ok: false,
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    attempts: buildAttemptSummary(
      {
        ...input.attempts,
        terminal_reason: input.terminal_reason ?? input.attempts?.terminal_reason
      },
      input.retryable
    )
  };
  if (input.provider) envelope.provider = input.provider;
  if (input.stdout !== void 0) envelope.stdout = input.stdout;
  if (input.stderr !== void 0) envelope.stderr = input.stderr;
  if (input.diagnostics) envelope.diagnostics = input.diagnostics;
  return envelope;
}
function buildAttemptSummary(attempts, retryable) {
  return {
    cli_attempts: attempts?.cli_attempts ?? 1,
    ...attempts?.provider_internal_attempts === void 0 ? {} : { provider_internal_attempts: attempts.provider_internal_attempts },
    ...attempts?.terminal_reason === void 0 ? {} : { terminal_reason: attempts.terminal_reason },
    retryable
  };
}

// src/plugins/consensus/provider-cli/schema-validate.ts
function validateSchemaSubset(value, schema) {
  if (!isRecord(schema)) return { ok: true };
  if (schema.type === "object" && !isRecord(value)) {
    return { ok: false, message: "Expected provider JSON to be an object." };
  }
  if (Array.isArray(schema.required)) {
    if (!isRecord(value)) {
      return {
        ok: false,
        message: "Expected provider JSON to be an object with required fields."
      };
    }
    for (const field of schema.required) {
      if (typeof field === "string" && !(field in value)) {
        return {
          ok: false,
          message: `Missing required JSON field: ${field}`
        };
      }
    }
  }
  if (isRecord(schema.properties) && isRecord(value)) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      if (!(field in value) || !isRecord(fieldSchema)) continue;
      const type = fieldSchema.type;
      if (typeof type === "string" && !matchesJsonType(value[field], type)) {
        return {
          ok: false,
          message: `Field ${field} must be ${type}.`
        };
      }
    }
  }
  return { ok: true };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function matchesJsonType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isRecord(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

// src/plugins/consensus/provider-cli/submit-capture.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import path3 from "node:path";
var DEFAULT_SUBMIT_CAPTURE_MAX_BYTES = 1024 * 1024 * 10;
var CONSENSUS_SUBMIT_MAX_BYTES_ENV = "CONSENSUS_SUBMIT_MAX_BYTES";
var CONSENSUS_SUBMIT_CAPTURE_DIR = ".consensus/submit";
var SubmitCaptureLimitError = class extends Error {
  bytes;
  maxBytes;
  constructor(bytes, maxBytes) {
    super(submitCaptureLimitMessage(bytes, maxBytes));
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
};
function submitCaptureMaxBytes(maxOutputBytes) {
  return maxOutputBytes ?? DEFAULT_SUBMIT_CAPTURE_MAX_BYTES;
}
function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}
function assertWithinSubmitCaptureLimit(value, maxBytes) {
  const bytes = byteLength(value);
  if (bytes > maxBytes) {
    throw new SubmitCaptureLimitError(bytes, maxBytes);
  }
}
function submitCaptureLimitMessage(bytes, maxBytes) {
  return `Submitted verdict exceeds submit capture limit of ${maxBytes} bytes (${bytes} bytes).`;
}
function submitCaptureDirectory(cwd) {
  return path3.resolve(cwd, CONSENSUS_SUBMIT_CAPTURE_DIR);
}
function submitCaptureFilePath(cwd, id = randomUUID2()) {
  return path3.join(submitCaptureDirectory(cwd), `consensus-submit-${id}.json`);
}

// src/plugins/consensus/provider-cli/structured-output.ts
function selectStructuredOutputStrategy(adapter, options = {}) {
  if (options.strategy) return options.strategy;
  if (options.submitCaptureEnabled && adapter.capabilities.schema_strategies.includes("constrained_native") && adapter.capabilities.schema_strategies.includes("prompt_only")) {
    return "prompt_only";
  }
  if (adapter.capabilities.schema_strategies.includes("constrained_native")) {
    return "constrained_native";
  }
  if (adapter.capabilities.schema_strategies.includes("provider_validated")) {
    return "provider_validated";
  }
  return "prompt_only";
}
async function runProviderTurn(request, dependencies = {}) {
  const registry = dependencies.registry ?? providerRegistry();
  const adapter = registry.get(request.provider);
  if (!adapter) {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_UNSUPPORTED",
      message: `Provider is not supported: ${request.provider}`,
      terminalReason: "unsupported_provider"
    });
  }
  const optionValidation = validateProviderOptions(
    request,
    adapter.capabilities
  );
  if (!optionValidation.ok) {
    return preInvocationFailure({
      provider: request.provider,
      code: optionValidation.code,
      message: optionValidation.message,
      terminalReason: optionValidation.option
    });
  }
  const hostGuard = evaluateHostGuard({
    host: request.host,
    provider: request.provider
  });
  if (!hostGuard.allowed) {
    return preInvocationFailure({
      provider: request.provider,
      code: hostGuard.code,
      message: hostGuard.message,
      terminalReason: "host_recursion_blocked",
      diagnostics: hostGuard.diagnostics
    });
  }
  const readSchema = dependencies.readSchema ?? readJsonSchema;
  let schema;
  try {
    schema = await readSchema(request.schema_path);
  } catch (error) {
    return preInvocationFailure({
      provider: request.provider,
      code: "CONSENSUS_CLI_USAGE",
      message: `Could not read schema: ${error instanceof Error ? error.message : String(error)}`,
      terminalReason: "schema_read_failed"
    });
  }
  const inlineJsonSchema = JSON.stringify(schema);
  if (inlineJsonSchema === void 0) {
    return preInvocationFailure({
      provider: request.provider,
      code: "CONSENSUS_CLI_USAGE",
      message: "Schema must be JSON-serializable.",
      terminalReason: "schema_read_failed"
    });
  }
  const effectiveRequest = {
    ...request,
    runtime_policy: defaultRuntimePolicy(request.runtime_policy)
  };
  const maxAttempts = effectiveRequest.max_attempts ?? 1;
  const submitCaptureEnabled = dependencies.transport?.submitCaptureEnabled ?? true;
  const strategy = selectStructuredOutputStrategy(adapter, {
    submitCaptureEnabled,
    strategy: dependencies.transport?.strategy
  });
  if (!adapter.capabilities.schema_strategies.includes(strategy)) {
    return preInvocationFailure({
      provider: request.provider,
      code: "PROVIDER_UNSUPPORTED_OPTION",
      message: `Provider does not support structured-output strategy: ${strategy}.`,
      terminalReason: "structured_output_strategy"
    });
  }
  const runSubprocess = dependencies.runSubprocess ?? runProviderSubprocess;
  const parentEnv = dependencies.parentEnv ?? process.env;
  const submitCapturePath = submitCaptureEnabled ? submitCaptureFilePath(effectiveRequest.cwd ?? process.cwd()) : void 0;
  const maxSubmitBytes = submitCaptureMaxBytes(request.max_output_bytes);
  const submitCommand = submitCaptureEnabled ? dependencies.submitCommand ?? buildConsensusSubmitCommand() : void 0;
  const childEnv = buildChildEnvironment({
    parentEnv,
    request: effectiveRequest,
    hostEnv: {
      ...hostGuard.child_env,
      ...submitCaptureEnabled && submitCommand && submitCapturePath ? {
        CONSENSUS_SUBMIT_COMMAND: submitCommand,
        CONSENSUS_SUBMIT_FILE: submitCapturePath,
        [CONSENSUS_SUBMIT_MAX_BYTES_ENV]: String(maxSubmitBytes),
        CONSENSUS_SUBMIT_SCHEMA: path4.resolve(request.schema_path)
      } : {}
    }
  });
  let validationFeedback;
  let lastInvocation;
  let exitClassification;
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (submitCapturePath) {
        await cleanupSubmitCaptureFile(submitCapturePath);
      }
      const invocationRequest = {
        ...effectiveRequest,
        prompt: promptForStrategy({
          prompt: request.prompt,
          strategy,
          inlineJsonSchema,
          submitCaptureEnabled,
          submitCommand,
          validationFeedback
        })
      };
      const invocation2 = buildProviderInvocation(adapter, invocationRequest, {
        strategy,
        inlineJsonSchema,
        lastMessageFile: dependencies.transport?.lastMessageFile,
        preserveLastMessageFile: dependencies.transport?.preserveLastMessageFile
      });
      lastInvocation = invocation2;
      const processResult = await runSubprocess(invocation2, {
        env: childEnv,
        maxOutputBytes: request.max_output_bytes,
        timeoutSec: request.max_runtime_sec
      });
      const diagnostics = mergeDiagnostics(
        {
          strategy_used: strategy,
          output_mode: invocation2.output_mode,
          redacted_command: invocation2.redacted_command
        },
        hostGuard.diagnostics,
        processResult.diagnostics,
        exitClassificationDiagnostics(exitClassification)
      );
      if (!processResult.ok) {
        const classification = adapter.classifyRunFailure(processResult);
        exitClassification = classification.exit_classification;
        const failureDiagnostics = mergeDiagnostics(
          diagnostics,
          exitClassificationDiagnostics(exitClassification)
        );
        if (classification.retryable && attempt < maxAttempts) {
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: classification.code,
          message: classification.message,
          retryable: false,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: classification.terminal_reason
          },
          diagnostics: failureDiagnostics
        });
      }
      const submittedVerdict = submitCapturePath ? await readSubmittedVerdict(submitCapturePath, schema, maxSubmitBytes) : { ok: false };
      if (submittedVerdict.ok) {
        return successEnvelope({
          provider: request.provider,
          args: invocation2.redacted_command,
          stdout: submittedVerdict.raw,
          stderr: processResult.stderr,
          json: submittedVerdict.value,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "success"
          },
          diagnostics: mergeDiagnostics(diagnostics, {
            verdict_source: "submit"
          })
        });
      }
      const providerOutput = extractProviderOutput(invocation2, processResult);
      const finalMessageDiagnostics = mergeDiagnostics(diagnostics, {
        verdict_source: "final_message"
      });
      if (!providerOutput.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = providerOutput.message;
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: "PROVIDER_INVALID_JSON",
          message: providerOutput.message,
          retryable: false,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "missing_provider_output"
          },
          diagnostics: finalMessageDiagnostics
        });
      }
      const parsed = parseProviderJson(providerOutput.value);
      if (!parsed.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = parsed.message;
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: "PROVIDER_INVALID_JSON",
          message: parsed.message,
          retryable: false,
          stdout: providerOutput.value,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "invalid_json"
          },
          diagnostics: finalMessageDiagnostics
        });
      }
      const verdictJson = extractStructuredJsonValue(parsed.value);
      const validation = validateSchemaSubset(verdictJson, schema);
      if (!validation.ok) {
        if (attempt < maxAttempts) {
          validationFeedback = validation.message;
          continue;
        }
        return failureEnvelope({
          provider: request.provider,
          code: "PROVIDER_SCHEMA_VALIDATION",
          message: validation.message,
          retryable: false,
          stdout: providerOutput.value,
          stderr: processResult.stderr,
          attempts: {
            cli_attempts: attempt,
            terminal_reason: "schema_validation"
          },
          diagnostics: finalMessageDiagnostics
        });
      }
      return successEnvelope({
        provider: request.provider,
        args: invocation2.redacted_command,
        stdout: providerOutput.value,
        stderr: processResult.stderr,
        json: verdictJson,
        attempts: {
          cli_attempts: attempt,
          terminal_reason: "success"
        },
        diagnostics: finalMessageDiagnostics
      });
    }
    return failureEnvelope({
      provider: request.provider,
      code: "PROVIDER_EXIT",
      message: "Provider run ended without a terminal result.",
      retryable: false,
      attempts: {
        cli_attempts: maxAttempts,
        terminal_reason: "attempt_budget_exhausted"
      },
      diagnostics: lastInvocation ? {
        strategy_used: strategy,
        output_mode: lastInvocation.output_mode,
        redacted_command: lastInvocation.redacted_command
      } : void 0
    });
  } finally {
    if (submitCapturePath) {
      await cleanupSubmitCaptureFile(submitCapturePath);
    }
  }
}
async function readJsonSchema(schemaPath) {
  return JSON.parse(await readFile(schemaPath, "utf8"));
}
function preInvocationFailure(input) {
  return failureEnvelope({
    provider: input.provider,
    code: input.code,
    message: input.message,
    retryable: false,
    attempts: {
      cli_attempts: 0,
      terminal_reason: input.terminalReason
    },
    diagnostics: input.diagnostics
  });
}
function extractProviderOutput(invocation2, result) {
  if (invocation2.output_mode !== "last_message_file") {
    return { ok: true, value: result.stdout };
  }
  if (result.ok && result.last_message?.trim()) {
    return { ok: true, value: result.last_message };
  }
  return {
    ok: false,
    message: "Provider did not write a last-message file response."
  };
}
function parseProviderJson(stdout) {
  try {
    return { ok: true, value: JSON.parse(stdout.trim()) };
  } catch (error) {
    return {
      ok: false,
      message: `Provider returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
async function readSubmittedVerdict(filePath, schema, maxBytes) {
  const capture = await readBoundedRegularFile(filePath, maxBytes);
  if (!capture.ok) return { ok: false };
  const raw = capture.contents;
  try {
    assertWithinSubmitCaptureLimit(raw, maxBytes);
  } catch {
    return { ok: false };
  }
  if (!raw.trim()) return { ok: false };
  const parsed = parseProviderJson(raw);
  if (!parsed.ok) return { ok: false };
  const validation = validateSchemaSubset(parsed.value, schema);
  if (!validation.ok) return { ok: false };
  return { ok: true, raw, value: parsed.value };
}
async function cleanupSubmitCaptureFile(filePath) {
  try {
    await rm2(filePath, { force: true });
  } catch {
  }
}
function extractStructuredJsonValue(value) {
  if (!isRecord(value)) return value;
  if ("structured_output" in value) {
    return value.structured_output;
  }
  const result = value.result;
  if (typeof result !== "string") return value;
  try {
    return JSON.parse(result.trim());
  } catch {
    return extractFirstJsonObject(result) ?? value;
  }
}
function promptForStrategy(input) {
  const parts = [input.prompt];
  if (input.submitCaptureEnabled) {
    const submitCommand = input.submitCommand ?? buildConsensusSubmitCommand();
    parts.push(
      "Verdict submission:",
      "Before ending the turn, submit the final verdict by running this exact command and passing the JSON verdict on stdin:",
      `\`${submitCommand}\``,
      "The same command is injected as CONSENSUS_SUBMIT_COMMAND; do not substitute a bare `consensus` executable.",
      "The command validates against the active schema from CONSENSUS_SUBMIT_SCHEMA and captures to CONSENSUS_SUBMIT_FILE.",
      "If submission fails, fix the reported schema error and run the command again.",
      "Also keep the final-message JSON fallback: end with only the same JSON object matching the schema."
    );
  }
  if (input.validationFeedback) {
    parts.push(
      `Schema validation failed: ${input.validationFeedback}`,
      "Return only JSON matching the schema."
    );
  }
  if (input.strategy === "prompt_only") {
    parts.push(
      "Structured output requirements:",
      "Return only one JSON object matching this JSON Schema.",
      "Do not wrap the JSON in Markdown.",
      "Do not include prose before or after the JSON object.",
      "<JSON_SCHEMA>",
      input.inlineJsonSchema,
      "</JSON_SCHEMA>"
    );
  }
  return parts.join("\n\n");
}
function extractFirstJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start === -1) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char !== "}") continue;
    depth -= 1;
    if (depth !== 0) continue;
    const candidate = text.slice(start, index + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      start = -1;
      depth = 0;
    }
  }
  return void 0;
}
function mergeDiagnostics(...diagnostics) {
  const merged = {};
  const warnings = [];
  for (const item of diagnostics) {
    if (!item) continue;
    Object.assign(merged, item);
    if (item.warnings) warnings.push(...item.warnings);
  }
  if (warnings.length > 0) merged.warnings = warnings;
  return merged;
}
function exitClassificationDiagnostics(exitClassification) {
  return exitClassification ? { exit_classification: exitClassification } : void 0;
}
function buildConsensusSubmitCommand(input = {}) {
  const nodePath = input.nodePath ?? process.execPath;
  const cliPath = input.cliPath ?? currentConsensusCliPath();
  return `${shellQuote(nodePath)} ${shellQuote(cliPath)} submit --json -`;
}
function currentConsensusCliPath() {
  if (process.argv[1]) return path4.resolve(process.argv[1]);
  return fileURLToPath(import.meta.url);
}
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// src/plugins/consensus/shared/cli-helpers-core.ts
import { lstat } from "node:fs/promises";
import path5 from "node:path";
function inside(root, target) {
  const relative = path5.relative(root, target);
  return relative === "" || !relative.startsWith("..") && !path5.isAbsolute(relative);
}

// src/skills/consensus-review/src/run.ts
async function runReview(input, dependencies = {}) {
  if (!input) return foundationOnly();
  if (input.provider !== "claude" && input.provider !== "codex") {
    return preflightFailure(
      "provider_ineligible",
      `Provider is not eligible for read-only review transport: ${String(input.provider)}.`
    );
  }
  const env = dependencies.env ?? process.env;
  const hostResolution = resolveExplicitHostContext({
    runtime: input.host,
    cwd: input.cwd,
    env,
    maxDepth: 1
  });
  if (!hostResolution.ok) {
    return preflightFailure(hostResolution.reason, hostResolution.message);
  }
  if (hostResolution.context.runtime === input.provider && input.allowSameProvider !== true) {
    return preflightFailure(
      "same_provider_consent_required",
      "Same-provider review requires explicit user consent."
    );
  }
  const transport = reviewTransport(input);
  if (!transport.ok) {
    return preflightFailure(transport.reason, transport.message);
  }
  const hostGuard = evaluateHostGuard({
    host: hostResolution.context,
    provider: input.provider
  });
  if (!hostGuard.allowed) {
    return preflightFailure("host_recursion_blocked", hostGuard.message);
  }
  const registry = dependencies.registry ?? providerRegistry();
  const probeRunner = dependencies.probeRunner ?? nodeProbeCommandRunner(env);
  const preflight = dependencies.preflight ?? defaultReviewPreflight;
  const readiness = await preflight({
    provider: input.provider,
    host: hostResolution.context,
    registry,
    probeRunner
  });
  if (readiness.status !== "ready") {
    return preflightFailure(
      `provider_${readiness.status}`,
      `Review provider ${input.provider} is not ready (${readiness.status}).`
    );
  }
  const request = {
    schema_version: "v1",
    provider: input.provider,
    schema_path: input.schemaPath,
    prompt: input.prompt,
    cwd: input.cwd,
    host: hostResolution.context,
    runtime_policy: input.provider === "claude" ? { permission_mode: "read-only" } : {
      permission_mode: "non-interactive",
      sandbox: "read-only",
      approval_policy: "never"
    },
    max_attempts: 1,
    max_runtime_sec: input.maxRuntimeSec ?? 600,
    max_output_bytes: input.maxOutputBytes ?? 1024 * 1024,
    ...input.model ? { model: input.model } : {},
    ...input.effort ? { effort: input.effort } : {}
  };
  const envelope = await (dependencies.runTurn ?? runProviderTurn)(request, {
    registry,
    parentEnv: env,
    transport: transport.options
  });
  if (!envelope.ok) {
    return {
      ok: false,
      status: "execution_failed",
      invocation_count: envelope.attempts.cli_attempts,
      reason: envelope.code,
      message: envelope.message,
      envelope
    };
  }
  return {
    ok: true,
    status: "completed",
    invocation_count: envelope.attempts.cli_attempts,
    envelope
  };
}
async function defaultReviewPreflight(input) {
  const [entry] = await probeProviderRegistry({
    registry: input.registry,
    runner: input.probeRunner,
    provider: input.provider,
    requiredCapabilities: ["run"]
  });
  if (entry) return entry;
  throw new Error(`Review provider is not registered: ${input.provider}`);
}
function reviewTransport(input) {
  if (input.provider === "claude") {
    return {
      ok: true,
      options: {
        submitCaptureEnabled: false,
        strategy: "provider_validated"
      }
    };
  }
  if (!input.codexCapturePath || !path6.isAbsolute(input.codexCapturePath)) {
    return {
      ok: false,
      reason: "capture_not_external",
      message: "Codex review capture must be an absolute external path."
    };
  }
  const capturePath = path6.resolve(input.codexCapturePath);
  if (inside(path6.resolve(input.cwd), capturePath)) {
    return {
      ok: false,
      reason: "capture_not_external",
      message: "Codex review capture must remain outside the reviewed worktree."
    };
  }
  return {
    ok: true,
    options: {
      submitCaptureEnabled: false,
      strategy: "prompt_only",
      lastMessageFile: capturePath,
      preserveLastMessageFile: true
    }
  };
}
function preflightFailure(reason, message) {
  return {
    ok: false,
    status: "preflight_failed",
    invocation_count: 0,
    reason,
    message
  };
}
function foundationOnly() {
  return { ok: false, status: "foundation_only", invocation_count: 0 };
}

// src/skills/consensus-review/src/review.ts
async function reviewMain() {
  const result = await runReview();
  process.stdout.write(`${JSON.stringify(result)}
`);
  return 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await reviewMain();
}
export {
  reviewMain,
  runReview
};
