import type { AgentType } from "../agents/types";
import type { PromptInput } from "./prompt-source";

export interface CompletionOptions {
  success: string;
  abort?: string;
  minIterations?: number;
  maxIterations?: number;
}

export interface ToolSummary {
  [toolName: string]: number;
}

export interface RuntimeOptions {
  heartbeatIntervalMs?: number;
  inactivityTimeoutMs?: number;
  iterationDelayMs?: number;
  cancelSignal?: AbortSignal;
}

export interface ReporterEventContext {
  iteration: number;
  maxIterations?: number;
}

export interface LoopReporter {
  onRunStart?(summary: { agent: AgentType; model?: string; promptSource: string }): void;
  onIterationStart?(context: ReporterEventContext): void;
  onStdoutChunk?(chunk: string): void;
  onStderrChunk?(chunk: string): void;
  onHeartbeat?(context: ReporterEventContext & { elapsedMs: number; idleMs: number }): void;
  onIterationEnd?(context: ReporterEventContext & { exitCode: number; completed: boolean; toolCounts: ToolSummary }): void;
  onComplete?(context: ReporterEventContext): void;
  onAbort?(context: ReporterEventContext & { promise: string }): void;
  onTimeout?(context: ReporterEventContext & { idleMs: number; timeoutMs: number; resumeHint?: string }): void;
  onCancelled?(context: ReporterEventContext): void;
}

export interface LoopState {
  active: boolean;
  iteration: number;
  agent: AgentType;
  model?: string;
  prompt: PromptInput;
  completion: CompletionOptions;
  runtime: RuntimeOptions;
  startedAt: string;
}

export interface LoopOptions {
  cwd: string;
  agent: {
    type: AgentType;
    model?: string;
    commandOverride?: string;
    allowAllPermissions?: boolean;
    extraFlags?: string[];
  };
  prompt: PromptInput;
  completion: CompletionOptions;
  runtime?: RuntimeOptions;
  interaction?: {
    onQuestion?: (question: string) => Promise<string | null>;
  };
  reporter?: LoopReporter;
}
