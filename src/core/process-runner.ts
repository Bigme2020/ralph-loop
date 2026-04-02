import type { AgentAdapter, AgentBuildOptions } from "../agents/types";
import type { ToolSummary } from "./types";

export interface ProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  cancelled: boolean;
  toolCounts: ToolSummary;
}

export interface ProcessRunOptions {
  cwd?: string;
  rawArgsMode?: boolean;
  heartbeatIntervalMs?: number;
  inactivityTimeoutMs?: number;
  cancelSignal?: AbortSignal;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  onHeartbeat?: (context: { elapsedMs: number; idleMs: number }) => void;
}

export async function runAgentProcess(
  command: string,
  adapter: AgentAdapter,
  prompt: string,
  options: AgentBuildOptions,
  runtime: ProcessRunOptions = {},
): Promise<ProcessRunResult> {
  const args = runtime.rawArgsMode ? [...(options.extraFlags ?? []), prompt] : adapter.buildArgs(prompt, options);
  const proc = Bun.spawn([command, ...args], {
    cwd: runtime.cwd ?? process.cwd(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...(adapter.buildEnv?.(options) ?? {}),
    },
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let cancelled = false;
  const startedAt = Date.now();
  let lastActivityAt = Date.now();
  const toolCounts: ToolSummary = {};

  const trackTools = (text: string) => {
    for (const line of text.split(/\r?\n/)) {
      const toolName = adapter.parseToolName(line);
      if (toolName) {
        toolCounts[toolName] = (toolCounts[toolName] ?? 0) + 1;
      }
    }
  };

  const readStream = async (stream: ReadableStream<Uint8Array> | null, onChunk: (chunk: string) => void) => {
    if (!stream) return;

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (!text) continue;
      lastActivityAt = Date.now();
      trackTools(text);
      onChunk(text);
    }
  };

  const killProcess = () => {
    try {
      if (process.platform !== "win32" && proc.pid) {
        process.kill(-proc.pid, "SIGKILL");
      } else {
        proc.kill("SIGKILL");
      }
    } catch {
      // ignore late kill failures
    }
  };

  const abortHandler = () => {
    cancelled = true;
    killProcess();
  };

  if (runtime.cancelSignal) {
    if (runtime.cancelSignal.aborted) {
      abortHandler();
    } else {
      runtime.cancelSignal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  const heartbeatIntervalMs = runtime.heartbeatIntervalMs ?? 10_000;
  const timer = setInterval(() => {
    const now = Date.now();
    runtime.onHeartbeat?.({
      elapsedMs: now - startedAt,
      idleMs: now - lastActivityAt,
    });

    if (runtime.inactivityTimeoutMs && now - lastActivityAt >= runtime.inactivityTimeoutMs) {
      timedOut = true;
      killProcess();
    }
  }, heartbeatIntervalMs);

  await Promise.all([
    readStream(proc.stdout, (chunk) => {
      stdout += chunk;
      runtime.onStdoutChunk?.(chunk);
    }),
    readStream(proc.stderr, (chunk) => {
      stderr += chunk;
      runtime.onStderrChunk?.(chunk);
    }),
    proc.exited,
  ]);

  clearInterval(timer);
  runtime.cancelSignal?.removeEventListener("abort", abortHandler);

  return {
    stdout,
    stderr,
    exitCode: proc.exitCode ?? (timedOut ? 124 : cancelled ? 130 : 1),
    timedOut,
    cancelled,
    toolCounts,
  };
}
