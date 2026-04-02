#!/usr/bin/env bun

import { createConsoleReporter } from "../src/ui/console-reporter";
import { createStateStore } from "../src/core/state-store";
import { runLoop } from "../src/core/loop-runner";

const args = process.argv.slice(2);
const passthroughIndex = args.indexOf("--");
const passthroughArgs = passthroughIndex >= 0 ? args.slice(passthroughIndex + 1) : [];
const parsedArgs = passthroughIndex >= 0 ? args.slice(0, passthroughIndex) : args;
const agentIndex = args.indexOf("--agent");
const promptFileIndex = parsedArgs.indexOf("--prompt-file");
const modelIndex = parsedArgs.indexOf("--model");
const maxIterationsIndex = parsedArgs.indexOf("--max-iterations");
const abortPromiseIndex = parsedArgs.indexOf("--abort-promise");
const completionPromiseIndex = parsedArgs.indexOf("--completion-promise");
const inactivityTimeoutIndex = parsedArgs.indexOf("--last-activity-timeout");
const resumeIndex = parsedArgs.indexOf("--resume");

const agent = agentIndex >= 0 ? parsedArgs[agentIndex + 1] : "opencode";
const promptFile = promptFileIndex >= 0 ? parsedArgs[promptFileIndex + 1] : undefined;
const model = modelIndex >= 0 ? parsedArgs[modelIndex + 1] : undefined;
const maxIterations = maxIterationsIndex >= 0 ? Number(parsedArgs[maxIterationsIndex + 1]) : undefined;
const abortPromise = abortPromiseIndex >= 0 ? parsedArgs[abortPromiseIndex + 1] : undefined;
const completionPromise = completionPromiseIndex >= 0 ? parsedArgs[completionPromiseIndex + 1] : "COMPLETE";
const inactivityTimeoutMs = inactivityTimeoutIndex >= 0 ? Number(parsedArgs[inactivityTimeoutIndex + 1]) : undefined;
const resume = resumeIndex >= 0;
const appendPromptIndex = parsedArgs.indexOf("--append-prompt");
const appendPrompt = appendPromptIndex >= 0 ? parsedArgs[appendPromptIndex + 1] : undefined;

const promptParts = parsedArgs.filter((arg, index) => {
  return ![
    agentIndex,
    agentIndex + 1,
    promptFileIndex,
    promptFileIndex + 1,
    modelIndex,
    modelIndex + 1,
    maxIterationsIndex,
    maxIterationsIndex + 1,
    abortPromiseIndex,
    abortPromiseIndex + 1,
    completionPromiseIndex,
    completionPromiseIndex + 1,
    inactivityTimeoutIndex,
    inactivityTimeoutIndex + 1,
    appendPromptIndex,
    appendPromptIndex + 1,
    resumeIndex,
  ].includes(index) && !arg.startsWith("--");
});

if (!resume && !promptFile && promptParts.length === 0) {
  console.error("Error: 缺少 prompt 输入");
  process.exit(1);
}

const stateStore = createStateStore(process.cwd());
const resumedState = resume ? stateStore.load() : null;
const controller = new AbortController();

const cancelRun = () => {
  controller.abort();
};

process.on("SIGINT", cancelRun);
process.on("SIGTERM", cancelRun);

if (resume && !resumedState) {
  console.error("Error: 当前目录没有可恢复的 active-run 状态");
  process.exit(1);
}

const result = await runLoop({
  cwd: process.cwd(),
  agent: {
    type: resumedState?.agent ?? (agent as "opencode" | "claude-code" | "codex" | "copilot"),
    model: resumedState?.model ?? model,
    extraFlags: passthroughArgs,
  },
  prompt: resumedState?.prompt ?? {
    text: promptParts.join(" ") || undefined,
    filePath: promptFile,
    append: appendPrompt,
  },
  completion: resumedState?.completion ?? {
    success: completionPromise,
    abort: abortPromise,
    maxIterations,
  },
  runtime: {
    heartbeatIntervalMs: 10_000,
    iterationDelayMs: 1000,
    inactivityTimeoutMs,
    cancelSignal: controller.signal,
  },
  reporter: createConsoleReporter(),
});

process.off("SIGINT", cancelRun);
process.off("SIGTERM", cancelRun);

if (result.status === "aborted") process.exit(2);
if (result.status === "timed-out") process.exit(124);
if (result.status === "cancelled") process.exit(130);
