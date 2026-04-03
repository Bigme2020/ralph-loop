import { createAuditStore, createRunSummary } from "./audit-store";
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
  const auditStore = createAuditStore(options.cwd);
  const state = createInitialState(options);
  const maxIterations = options.completion.maxIterations ?? 0;
  const minIterations = options.completion.minIterations ?? 1;

  const promptSource = options.prompt.filePath ?? "inline";
  const initialPrompt = resolvePromptForIteration(state);
  const runId = auditStore.createRunId();
  options.reporter?.onRunStart?.({
    agent: options.agent.type,
    model: options.agent.model,
    promptSource,
  });

  auditStore.initialize({
    runId,
    startedAt: state.startedAt,
    cwd: options.cwd,
    agent: options.agent.type,
    model: options.agent.model,
    promptSource,
    promptLength: initialPrompt.length,
    status: "running",
    iterations: [],
  });
  stateStore.save(state);

  try {
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
      const question = adapter.detectQuestion(normalized);
      let answerProvided = false;
      let answerLength: number | undefined;

      if (question && options.interaction?.onQuestion) {
        const answer = await options.interaction.onQuestion(question);
        if (answer?.trim()) {
          answerProvided = true;
          answerLength = answer.trim().length;
          state.prompt = {
            ...state.prompt,
            text: appendAnswerContext(resolvePromptForIteration(state), answer),
            filePath: undefined,
            append: undefined,
          };
        }
      }

      auditStore.appendIteration(runId, {
        iteration: state.iteration,
        exitCode: result.exitCode,
        completed: success,
        tools: result.toolCounts,
        askedQuestion: !!question,
        answerProvided,
        ...(answerLength ? { answerLength } : {}),
      });

      options.reporter?.onIterationEnd?.({
        iteration: state.iteration,
        maxIterations: maxIterations || undefined,
        exitCode: result.exitCode,
        completed: success,
        toolCounts: result.toolCounts,
      });

      if (result.cancelled) {
        const summary = createRunSummary("cancelled", { iteration: state.iteration });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "cancelled",
          completedIterations: state.iteration,
          summary,
        });
        stateStore.clear();
        options.reporter?.onCancelled?.({ iteration: state.iteration, maxIterations: maxIterations || undefined });
        return { status: "cancelled", completedIterations: state.iteration };
      }

      if (result.timedOut) {
        const summary = createRunSummary("timed-out", { iteration: state.iteration });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "timed-out",
          completedIterations: state.iteration,
          summary,
        });
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
        const summary = createRunSummary("aborted", {
          iteration: state.iteration,
          promise: options.completion.abort!,
        });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "aborted",
          completedIterations: state.iteration,
          summary,
        });
        stateStore.clear();
        options.reporter?.onAbort?.({
          iteration: state.iteration,
          maxIterations: maxIterations || undefined,
          promise: options.completion.abort!,
        });
        return { status: "aborted", completedIterations: state.iteration };
      }

      if (success && state.iteration >= minIterations) {
        const summary = createRunSummary("completed", { iteration: state.iteration });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "completed",
          completedIterations: state.iteration,
          summary,
        });
        stateStore.clear();
        options.reporter?.onComplete?.({ iteration: state.iteration, maxIterations: maxIterations || undefined });
        return { status: "completed", completedIterations: state.iteration };
      }

      state.iteration += 1;
      stateStore.save(state);

      if (options.runtime?.iterationDelayMs) {
        await Bun.sleep(options.runtime.iterationDelayMs);
      }
    }
  } catch (error) {
    auditStore.finalize(runId, {
      endedAt: new Date().toISOString(),
      status: "crashed",
      completedIterations: Math.max(state.iteration - 1, 0),
      summary: createRunSummary("crashed", { iteration: state.iteration }),
    });
    stateStore.clear();
    throw error;
  }

  auditStore.finalize(runId, {
    endedAt: new Date().toISOString(),
    status: "max-iterations",
    completedIterations: maxIterations,
    summary: createRunSummary("max-iterations", { iteration: maxIterations, maxIterations }),
  });
  stateStore.clear();
  return { status: "max-iterations", completedIterations: maxIterations };
}
