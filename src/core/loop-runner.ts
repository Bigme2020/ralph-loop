import { resolvePromptText } from "./prompt-source";
import { createStateStore } from "./state-store";
import { checkTerminalPromise } from "./completion";
import { getAgentAdapter, getAgentBinaryOverride, resolveCommand } from "../agents/registry";
import { runAgentProcess } from "./process-runner";
import { appendAnswerContext } from "./question-flow";
import type { LoopOptions, LoopState } from "./types";

export interface LoopRunResult {
  status: "completed" | "aborted" | "timed-out" | "cancelled" | "max-iterations";
  completedIterations: number;
}

export function createInitialState(options: LoopOptions): LoopState {
  return {
    active: true,
    iteration: 1,
    agent: options.agent.type,
    model: options.agent.model,
    prompt: options.prompt,
    completion: options.completion,
    runtime: options.runtime ?? {},
    startedAt: new Date().toISOString(),
  };
}

export function resolvePromptForIteration(state: LoopState): string {
  return resolvePromptText(state.prompt);
}

export function buildResumeHint(cwd: string): string {
  return `cd ${cwd} && bun run bin/ralph-loop.ts --resume`;
}

export async function runLoop(options: LoopOptions): Promise<LoopRunResult> {
  const stateStore = createStateStore(options.cwd);
  const state = createInitialState(options);
  const maxIterations = options.completion.maxIterations ?? 0;
  const minIterations = options.completion.minIterations ?? 1;

  const promptSource = options.prompt.filePath ?? "inline";
  options.reporter?.onRunStart?.({
    agent: options.agent.type,
    model: options.agent.model,
    promptSource,
  });

  stateStore.save(state);

  while (maxIterations === 0 || state.iteration <= maxIterations) {
    const prompt = resolvePromptForIteration(state);
    const adapter = getAgentAdapter(state.agent);
    const command = resolveCommand(
      adapter.binaryName,
      options.agent.commandOverride ?? getAgentBinaryOverride(options.agent.type),
    );

    options.reporter?.onIterationStart?.({ iteration: state.iteration, maxIterations: maxIterations || undefined });

    const result = await runAgentProcess(
      command,
      adapter,
      prompt,
      {
        model: options.agent.model,
        allowAllPermissions: options.agent.allowAllPermissions,
        extraFlags: options.agent.extraFlags,
      },
      {
        cwd: options.cwd,
        rawArgsMode: !!options.agent.commandOverride,
        heartbeatIntervalMs: options.runtime?.heartbeatIntervalMs,
        inactivityTimeoutMs: options.runtime?.inactivityTimeoutMs,
        cancelSignal: options.runtime?.cancelSignal,
        onStdoutChunk: (chunk) => {
          options.reporter?.onStdoutChunk?.(chunk);
        },
        onStderrChunk: (chunk) => {
          options.reporter?.onStderrChunk?.(chunk);
        },
        onHeartbeat: ({ elapsedMs, idleMs }) => {
          options.reporter?.onHeartbeat?.({
            iteration: state.iteration,
            maxIterations: maxIterations || undefined,
            elapsedMs,
            idleMs,
          });
        },
      },
    );

    const normalized = adapter.normalizeOutput(`${result.stdout}\n${result.stderr}`);
    const success = checkTerminalPromise(normalized, options.completion.success);
    const abort = options.completion.abort
      ? checkTerminalPromise(normalized, options.completion.abort)
      : false;

    options.reporter?.onIterationEnd?.({
      iteration: state.iteration,
      maxIterations: maxIterations || undefined,
      exitCode: result.exitCode,
      completed: success,
      toolCounts: result.toolCounts,
    });

    if (result.cancelled) {
      stateStore.clear();
      options.reporter?.onCancelled?.({ iteration: state.iteration, maxIterations: maxIterations || undefined });
      return { status: "cancelled", completedIterations: state.iteration };
    }

    if (result.timedOut) {
      options.reporter?.onTimeout?.({
        iteration: state.iteration,
        maxIterations: maxIterations || undefined,
        idleMs: options.runtime?.inactivityTimeoutMs ?? 0,
        timeoutMs: options.runtime?.inactivityTimeoutMs ?? 0,
        resumeHint: buildResumeHint(options.cwd),
      });
      return { status: "timed-out", completedIterations: state.iteration };
    }

    if (abort) {
      stateStore.clear();
      options.reporter?.onAbort?.({
        iteration: state.iteration,
        maxIterations: maxIterations || undefined,
        promise: options.completion.abort!,
      });
      return { status: "aborted", completedIterations: state.iteration };
    }

    if (success && state.iteration >= minIterations) {
      stateStore.clear();
      options.reporter?.onComplete?.({ iteration: state.iteration, maxIterations: maxIterations || undefined });
      return { status: "completed", completedIterations: state.iteration };
    }

    const question = adapter.detectQuestion(normalized);
    if (question && options.interaction?.onQuestion) {
      const answer = await options.interaction.onQuestion(question);
      if (answer?.trim()) {
        state.prompt = {
          ...state.prompt,
          text: appendAnswerContext(resolvePromptForIteration(state), answer),
          filePath: undefined,
          append: undefined,
        };
      }
    }

    state.iteration += 1;
    stateStore.save(state);

    if (options.runtime?.iterationDelayMs) {
      await Bun.sleep(options.runtime.iterationDelayMs);
    }
  }

  stateStore.clear();
  return { status: "max-iterations", completedIterations: maxIterations };
}
