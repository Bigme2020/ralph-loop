#!/usr/bin/env bun
// @bun

// src/ui/console-reporter.ts
var ANSI_COLOR_CODES = {
  default: "39",
  gray: "90",
  blue: "34",
  cyan: "36",
  green: "32",
  yellow: "33",
  red: "31",
  magenta: "35"
};
function formatIterationLabel(context) {
  if (context.maxIterations && context.maxIterations > 0) {
    return `${context.iteration}/${context.maxIterations}`;
  }
  return `${context.iteration}`;
}
function supportsColor(forceColor) {
  if (typeof forceColor === "boolean") {
    return forceColor;
  }
  return Boolean(process.stdout.isTTY && process.stderr.isTTY);
}
function colorize(text, color, enabled) {
  if (!enabled || color === "default") {
    return text;
  }
  return `\x1B[${ANSI_COLOR_CODES[color]}m${text}\x1B[0m`;
}
function createConsoleReporter(options = {}) {
  const colorEnabled = supportsColor(options.forceColor);
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const colors = options.colors;
  const writeCoreLine = (line) => {
    stdout.write(`${colorize(line, colors?.core ?? "default", colorEnabled)}
`);
  };
  return {
    onRunStart(summary) {
      writeCoreLine("== Ralph Loop ==");
      writeCoreLine(`Agent: ${summary.agent}`);
      if (summary.model) {
        writeCoreLine(`Model: ${summary.model}`);
      }
      writeCoreLine(`Prompt source: ${summary.promptSource}`);
      stdout.write(`
`);
    },
    onIterationStart(context) {
      writeCoreLine(`-- Iteration ${formatIterationLabel(context)} --`);
    },
    onStdoutChunk(chunk) {
      stdout.write(colorize(chunk, colors?.agentStdout ?? "default", colorEnabled));
    },
    onStderrChunk(chunk) {
      stderr.write(colorize(chunk, colors?.agentStderr ?? "default", colorEnabled));
    },
    onHeartbeat(context) {
      writeCoreLine(`heartbeat: elapsed ${context.elapsedMs}ms, idle ${context.idleMs}ms`);
    },
    onIterationEnd(context) {
      writeCoreLine(`iteration ${formatIterationLabel(context)} exit=${context.exitCode} completed=${context.completed}`);
      const tools = Object.entries(context.toolCounts);
      if (tools.length > 0) {
        writeCoreLine(`tools: ${tools.map(([name, count]) => `${name}=${count}`).join(", ")}`);
      }
    },
    onSignalDeferred(context) {
      writeCoreLine(`signal ${context.promise} detected at iteration ${formatIterationLabel(context)} but deferred until minIterations=${context.minIterations}`);
    },
    onComplete(context) {
      writeCoreLine(`complete after iteration ${formatIterationLabel(context)}`);
    },
    onAbort(context) {
      writeCoreLine(`abort after iteration ${formatIterationLabel(context)} via ${context.promise}`);
    },
    onTimeout(context) {
      writeCoreLine(`timeout after iteration ${formatIterationLabel(context)} idle=${context.idleMs}ms limit=${context.timeoutMs}ms`);
      if (context.resumeHint) {
        writeCoreLine(`resume: ${context.resumeHint}`);
      }
    },
    onCancelled(context) {
      writeCoreLine(`cancelled after iteration ${formatIterationLabel(context)}`);
    }
  };
}

// src/core/state-store.ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
function createStateStore(cwd, stateDirName = ".ralph-loop") {
  const stateDir = join(cwd, stateDirName);
  const statePath = join(stateDir, "active-run.json");
  return {
    stateDir,
    statePath,
    load() {
      if (!existsSync(statePath)) {
        return null;
      }
      try {
        return JSON.parse(readFileSync(statePath, "utf8"));
      } catch {
        return null;
      }
    },
    save(state) {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(statePath, `${JSON.stringify(state, null, 2)}
`, "utf8");
    },
    clear() {
      if (existsSync(statePath)) {
        rmSync(statePath, { force: true });
      }
    }
  };
}

// src/core/audit-store.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { randomBytes } from "crypto";
import { join as join2 } from "path";
function formatRunIdTimestamp(date) {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function buildSummary(status, context) {
  switch (status) {
    case "completed":
      return `completed after ${context.iteration} iterations`;
    case "aborted":
      return `aborted after ${context.iteration} iterations via ${context.promise ?? "ABORT"}`;
    case "timed-out":
      return `timed out at iteration ${context.iteration}`;
    case "cancelled":
      return `cancelled at iteration ${context.iteration}`;
    case "max-iterations":
      return `stopped at max iterations ${context.maxIterations ?? context.iteration}`;
    case "crashed":
      return `crashed during iteration ${context.iteration}`;
  }
}
function writeJsonFile(filePath, value) {
  writeFileSync2(filePath, `${JSON.stringify(value, null, 2)}
`, "utf8");
}
function createAuditStore(cwd, stateDirName = ".ralph-loop") {
  const stateDir = join2(cwd, stateDirName);
  const runsDir = join2(stateDir, "runs");
  const historyPath = join2(stateDir, "history.jsonl");
  const getRunPath = (runId) => join2(runsDir, `${runId}.json`);
  const readRun = (runId) => {
    return JSON.parse(readFileSync2(getRunPath(runId), "utf8"));
  };
  const ensureDirs = () => {
    mkdirSync2(runsDir, { recursive: true });
  };
  return {
    createRunId() {
      return `${formatRunIdTimestamp(new Date)}-${randomBytes(3).toString("hex")}`;
    },
    initialize(record) {
      ensureDirs();
      writeJsonFile(getRunPath(record.runId), record);
    },
    appendIteration(runId, iteration) {
      const record = readRun(runId);
      record.iterations.push(iteration);
      writeJsonFile(getRunPath(runId), record);
    },
    finalize(runId, terminal) {
      const record = readRun(runId);
      record.endedAt = terminal.endedAt;
      record.status = terminal.status;
      record.completedIterations = terminal.completedIterations;
      record.summary = terminal.summary;
      writeJsonFile(getRunPath(runId), record);
      const historyEntry = {
        runId: record.runId,
        startedAt: record.startedAt,
        endedAt: terminal.endedAt,
        cwd: record.cwd,
        agent: record.agent,
        model: record.model,
        status: terminal.status,
        completedIterations: terminal.completedIterations,
        summary: terminal.summary
      };
      const previous = existsSync2(historyPath) ? readFileSync2(historyPath, "utf8") : "";
      writeFileSync2(historyPath, `${previous}${JSON.stringify(historyEntry)}
`, "utf8");
    }
  };
}
function createRunSummary(status, context) {
  return buildSummary(status, context);
}

// src/core/prompt-source.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, statSync } from "fs";
function resolvePromptText(input) {
  const parts = [];
  if (input.filePath) {
    if (!existsSync3(input.filePath)) {
      throw new Error(`prompt \u6587\u4EF6\u4E0D\u5B58\u5728: ${input.filePath}`);
    }
    if (!statSync(input.filePath).isFile()) {
      throw new Error(`prompt \u8DEF\u5F84\u4E0D\u662F\u6587\u4EF6: ${input.filePath}`);
    }
    const content = readFileSync3(input.filePath, "utf8").trim();
    if (!content) {
      throw new Error(`prompt \u6587\u4EF6\u4E3A\u7A7A: ${input.filePath}`);
    }
    parts.push(content);
  }
  if (input.text?.trim()) {
    parts.push(input.text.trim());
  }
  if (input.append?.trim()) {
    parts.push(input.append.trim());
  }
  if (parts.length === 0) {
    throw new Error("\u5FC5\u987B\u63D0\u4F9B prompt \u6587\u672C\u6216 prompt \u6587\u4EF6");
  }
  return parts.join(`

`);
}

// src/core/completion.ts
function stripAnsi(input) {
  return input.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "");
}
function stripTrailingNoise(input) {
  return stripAnsi(input).replace(/[\u200B-\u200D\u2060\uFEFF]+$/g, "").replace(/[\b\u0000]+$/g, "").trimEnd();
}
function getLastNonEmptyLine(output) {
  const lines = stripTrailingNoise(output).replace(/\r\n/g, `
`).split(`
`).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}
function checkTerminalPromise(output, promise) {
  const escaped = promise.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const terminalPromisePattern = new RegExp(`^<promise>\\s*${escaped}\\s*</promise>$`, "i");
  const normalized = stripTrailingNoise(output).replace(/\r\n/g, `
`).trim();
  const lastLine = getLastNonEmptyLine(normalized);
  if (lastLine && terminalPromisePattern.test(lastLine)) {
    return true;
  }
  return new RegExp("```(?:\\w+)?\\n\\s*<promise>\\s*" + escaped + "\\s*</promise>\\s*\\n```$", "i").test(normalized);
}

// src/agents/shared.ts
function appendExtraFlags(args, options) {
  if (options.extraFlags?.length) {
    args.push(...options.extraFlags);
  }
  return args;
}
function defaultNormalizeOutput(output) {
  return output;
}
function defaultDetectQuestion(output) {
  const match = output.match(/(?:question|asking|please confirm|do you want|should i|can i)\s*[:\-]?\s*(.+)/i);
  return match ? match[1].trim() : null;
}
function defaultParseToolName(line) {
  const match = line.match(/(?:Tool:|Using|Calling|Running)\s+([A-Za-z0-9_.-]+)/i);
  return match ? match[1] : null;
}

// src/agents/claude-code.ts
function collectTextCandidate(results, value) {
  if (value?.trim()) {
    results.push(value.trim());
  }
}
function extractDisplayLines(output) {
  const results = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      if (trimmed)
        results.push(trimmed);
      continue;
    }
    try {
      const payload = JSON.parse(trimmed);
      collectTextCandidate(results, payload.text);
      collectTextCandidate(results, payload.content);
      collectTextCandidate(results, payload.result);
      const content = payload.message?.content ?? [];
      for (const block of content) {
        if (block.type === "text") {
          collectTextCandidate(results, block.text);
        }
      }
    } catch {
      if (trimmed)
        results.push(trimmed);
    }
  }
  return results;
}
var claudeCodeAdapter = {
  type: "claude-code",
  binaryName: "claude",
  buildArgs(prompt, options) {
    const args = ["-p", prompt];
    if (options.model)
      args.push("--model", options.model);
    if (options.allowAllPermissions)
      args.push("--dangerously-skip-permissions");
    return appendExtraFlags(args, options);
  },
  parseToolName(line) {
    const cleanLine = line.trim();
    const match = cleanLine.match(/(?:Using|Called|Tool:)\s+([A-Za-z0-9_.-]+)/i);
    return match ? match[1] : null;
  },
  normalizeOutput(output) {
    return extractDisplayLines(output).join(`
`);
  },
  detectQuestion(output) {
    return defaultDetectQuestion(extractDisplayLines(output).join(`
`));
  }
};

// src/agents/codex.ts
var codexAdapter = {
  type: "codex",
  binaryName: "codex",
  buildArgs(prompt, options) {
    const args = ["exec"];
    if (options.model)
      args.push("--model", options.model);
    if (options.allowAllPermissions)
      args.push("--full-auto");
    appendExtraFlags(args, options);
    args.push(prompt);
    return args;
  },
  parseToolName: defaultParseToolName,
  normalizeOutput: defaultNormalizeOutput,
  detectQuestion: defaultDetectQuestion
};

// src/agents/copilot.ts
var copilotAdapter = {
  type: "copilot",
  binaryName: "copilot",
  buildArgs(prompt, options) {
    const args = ["-p", prompt];
    if (options.model)
      args.push("--model", options.model);
    if (options.allowAllPermissions)
      args.push("--allow-all", "--no-ask-user");
    return appendExtraFlags(args, options);
  },
  parseToolName: defaultParseToolName,
  normalizeOutput: defaultNormalizeOutput,
  detectQuestion: defaultDetectQuestion
};

// src/agents/opencode.ts
var opencodeAdapter = {
  type: "opencode",
  binaryName: "opencode",
  buildArgs(prompt, options) {
    const args = ["run"];
    if (options.model)
      args.push("-m", options.model);
    appendExtraFlags(args, options);
    args.push(prompt);
    return args;
  },
  parseToolName(line) {
    const match = line.match(/^\|\s{2}([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  },
  normalizeOutput: defaultNormalizeOutput,
  detectQuestion(output) {
    if (/^\|\s{2}question\b/im.test(output)) {
      return defaultDetectQuestion(output);
    }
    return null;
  }
};

// src/agents/registry.ts
var adapters = {
  opencode: opencodeAdapter,
  "claude-code": claudeCodeAdapter,
  codex: codexAdapter,
  copilot: copilotAdapter
};
function getAgentAdapter(type) {
  return adapters[type];
}
function getAgentBinaryOverride(type, env = process.env) {
  switch (type) {
    case "opencode":
      return env.RALPH_OPENCODE_BINARY;
    case "claude-code":
      return env.RALPH_CLAUDE_BINARY;
    case "codex":
      return env.RALPH_CODEX_BINARY;
    case "copilot":
      return env.RALPH_COPILOT_BINARY;
  }
}
function resolveCommand(binaryName, override) {
  if (override)
    return override;
  if (process.platform === "win32" && !Bun.which(binaryName)) {
    const cmdBinary = `${binaryName}.cmd`;
    if (Bun.which(cmdBinary))
      return cmdBinary;
  }
  return binaryName;
}

// src/core/process-runner.ts
async function runAgentProcess(command, adapter, prompt, options, runtime = {}) {
  const args = runtime.rawArgsMode ? [...options.extraFlags ?? [], prompt] : adapter.buildArgs(prompt, options);
  const proc = Bun.spawn([command, ...args], {
    cwd: runtime.cwd ?? process.cwd(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...adapter.buildEnv?.(options) ?? {}
    }
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let cancelled = false;
  const startedAt = Date.now();
  let lastActivityAt = Date.now();
  const toolCounts = {};
  const trackTools = (text) => {
    for (const line of text.split(/\r?\n/)) {
      const toolName = adapter.parseToolName(line);
      if (toolName) {
        toolCounts[toolName] = (toolCounts[toolName] ?? 0) + 1;
      }
    }
  };
  const readStream = async (stream, onChunk) => {
    if (!stream)
      return;
    const reader = stream.getReader();
    const decoder = new TextDecoder;
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      const text = decoder.decode(value, { stream: true });
      if (!text)
        continue;
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
    } catch {}
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
  const heartbeatIntervalMs = runtime.heartbeatIntervalMs ?? 1e4;
  const timer = setInterval(() => {
    const now = Date.now();
    runtime.onHeartbeat?.({
      elapsedMs: now - startedAt,
      idleMs: now - lastActivityAt
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
    proc.exited
  ]);
  clearInterval(timer);
  runtime.cancelSignal?.removeEventListener("abort", abortHandler);
  return {
    stdout,
    stderr,
    exitCode: proc.exitCode ?? (timedOut ? 124 : cancelled ? 130 : 1),
    timedOut,
    cancelled,
    toolCounts
  };
}

// src/core/question-flow.ts
function appendAnswerContext(prompt, answer) {
  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer) {
    return prompt;
  }
  return `${prompt}

## \u4E0A\u4E00\u8F6E\u4EA4\u4E92\u56DE\u7B54
${trimmedAnswer}`;
}

// src/core/loop-runner.ts
function createInitialState(options) {
  return {
    active: true,
    iteration: 1,
    agent: options.agent.type,
    model: options.agent.model,
    prompt: options.prompt,
    completion: options.completion,
    runtime: options.runtime ?? {},
    startedAt: new Date().toISOString()
  };
}
function resolvePromptForIteration(state) {
  return resolvePromptText(state.prompt);
}
function buildResumeHint(cwd) {
  return `cd ${cwd} && bun run bin/ralph-loop.ts --resume`;
}
async function runLoop(options) {
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
    promptSource
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
    iterations: []
  });
  stateStore.save(state);
  try {
    while (maxIterations === 0 || state.iteration <= maxIterations) {
      const prompt = resolvePromptForIteration(state);
      const adapter = getAgentAdapter(state.agent);
      const command = resolveCommand(adapter.binaryName, options.agent.commandOverride ?? getAgentBinaryOverride(options.agent.type));
      options.reporter?.onIterationStart?.({ iteration: state.iteration, maxIterations: maxIterations || undefined });
      const result = await runAgentProcess(command, adapter, prompt, {
        model: options.agent.model,
        allowAllPermissions: options.agent.allowAllPermissions,
        extraFlags: options.agent.extraFlags
      }, {
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
            idleMs
          });
        }
      });
      const normalizedStdout = adapter.normalizeOutput(result.stdout);
      const normalizedCombined = adapter.normalizeOutput(`${result.stdout}
${result.stderr}`);
      const success = checkTerminalPromise(normalizedStdout, options.completion.success);
      const abort = options.completion.abort ? checkTerminalPromise(normalizedStdout, options.completion.abort) : false;
      const question = adapter.detectQuestion(normalizedCombined);
      let answerProvided = false;
      let answerLength;
      if (question && options.interaction?.onQuestion) {
        const answer = await options.interaction.onQuestion(question);
        if (answer?.trim()) {
          answerProvided = true;
          answerLength = answer.trim().length;
          state.prompt = {
            ...state.prompt,
            text: appendAnswerContext(resolvePromptForIteration(state), answer),
            filePath: undefined,
            append: undefined
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
        ...answerLength ? { answerLength } : {}
      });
      options.reporter?.onIterationEnd?.({
        iteration: state.iteration,
        maxIterations: maxIterations || undefined,
        exitCode: result.exitCode,
        completed: success,
        toolCounts: result.toolCounts
      });
      if (result.cancelled) {
        const summary = createRunSummary("cancelled", { iteration: state.iteration });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "cancelled",
          completedIterations: state.iteration,
          summary
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
          summary
        });
        options.reporter?.onTimeout?.({
          iteration: state.iteration,
          maxIterations: maxIterations || undefined,
          idleMs: options.runtime?.inactivityTimeoutMs ?? 0,
          timeoutMs: options.runtime?.inactivityTimeoutMs ?? 0,
          resumeHint: buildResumeHint(options.cwd)
        });
        return { status: "timed-out", completedIterations: state.iteration };
      }
      if (abort) {
        const summary = createRunSummary("aborted", {
          iteration: state.iteration,
          promise: options.completion.abort
        });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "aborted",
          completedIterations: state.iteration,
          summary
        });
        stateStore.clear();
        options.reporter?.onAbort?.({
          iteration: state.iteration,
          maxIterations: maxIterations || undefined,
          promise: options.completion.abort
        });
        return { status: "aborted", completedIterations: state.iteration };
      }
      if (success && state.iteration < minIterations) {
        options.reporter?.onSignalDeferred?.({
          iteration: state.iteration,
          maxIterations: maxIterations || undefined,
          promise: options.completion.success,
          minIterations
        });
      }
      if (success && state.iteration >= minIterations) {
        const summary = createRunSummary("completed", { iteration: state.iteration });
        auditStore.finalize(runId, {
          endedAt: new Date().toISOString(),
          status: "completed",
          completedIterations: state.iteration,
          summary
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
      summary: createRunSummary("crashed", { iteration: state.iteration })
    });
    stateStore.clear();
    throw error;
  }
  auditStore.finalize(runId, {
    endedAt: new Date().toISOString(),
    status: "max-iterations",
    completedIterations: maxIterations,
    summary: createRunSummary("max-iterations", { iteration: maxIterations, maxIterations })
  });
  stateStore.clear();
  return { status: "max-iterations", completedIterations: maxIterations };
}

// src/config/cli-config.ts
import { existsSync as existsSync4, readFileSync as readFileSync4 } from "fs";
import { homedir } from "os";
import { join as join3 } from "path";
var CLI_COLOR_NAMES = ["default", "gray", "blue", "cyan", "green", "yellow", "red", "magenta"];
var DEFAULT_CLI_CONFIG = {
  colors: {
    core: "cyan",
    agentStdout: "default",
    agentStderr: "yellow"
  }
};
function stripJsonComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s+)\/\/.*$/gm, "$1");
}
function isColorName(value) {
  return typeof value === "string" && CLI_COLOR_NAMES.includes(value);
}
function parseConfigFile(filePath) {
  if (!existsSync4(filePath)) {
    return {};
  }
  try {
    return JSON.parse(stripJsonComments(readFileSync4(filePath, "utf8")));
  } catch {
    return {};
  }
}
function mergeColors(base, source) {
  if (!source) {
    return base;
  }
  return {
    core: isColorName(source.core) ? source.core : base.core,
    agentStdout: isColorName(source.agentStdout) ? source.agentStdout : base.agentStdout,
    agentStderr: isColorName(source.agentStderr) ? source.agentStderr : base.agentStderr
  };
}
function loadCliConfig(options) {
  const globalConfig = parseConfigFile(join3(options.homeDir ?? homedir(), ".ralph-loop", "config.jsonc"));
  const projectConfig = parseConfigFile(join3(options.cwd, ".ralph-loop", "config.jsonc"));
  return {
    colors: mergeColors(mergeColors(DEFAULT_CLI_CONFIG.colors, globalConfig.colors), projectConfig.colors)
  };
}

// bin/ralph-loop.ts
var args = process.argv.slice(2);
var passthroughIndex = args.indexOf("--");
var passthroughArgs = passthroughIndex >= 0 ? args.slice(passthroughIndex + 1) : [];
var parsedArgs = passthroughIndex >= 0 ? args.slice(0, passthroughIndex) : args;
var agentIndex = args.indexOf("--agent");
var promptFileIndex = parsedArgs.indexOf("--prompt-file");
var modelIndex = parsedArgs.indexOf("--model");
var maxIterationsIndex = parsedArgs.indexOf("--max-iterations");
var abortPromiseIndex = parsedArgs.indexOf("--abort-promise");
var completionPromiseIndex = parsedArgs.indexOf("--completion-promise");
var inactivityTimeoutIndex = parsedArgs.indexOf("--last-activity-timeout");
var resumeIndex = parsedArgs.indexOf("--resume");
var agent = agentIndex >= 0 ? parsedArgs[agentIndex + 1] : "opencode";
var promptFile = promptFileIndex >= 0 ? parsedArgs[promptFileIndex + 1] : undefined;
var model = modelIndex >= 0 ? parsedArgs[modelIndex + 1] : undefined;
var maxIterations = maxIterationsIndex >= 0 ? Number(parsedArgs[maxIterationsIndex + 1]) : undefined;
var abortPromise = abortPromiseIndex >= 0 ? parsedArgs[abortPromiseIndex + 1] : undefined;
var completionPromise = completionPromiseIndex >= 0 ? parsedArgs[completionPromiseIndex + 1] : "COMPLETE";
var inactivityTimeoutMs = inactivityTimeoutIndex >= 0 ? Number(parsedArgs[inactivityTimeoutIndex + 1]) : undefined;
var resume = resumeIndex >= 0;
var appendPromptIndex = parsedArgs.indexOf("--append-prompt");
var appendPrompt = appendPromptIndex >= 0 ? parsedArgs[appendPromptIndex + 1] : undefined;
var promptParts = parsedArgs.filter((arg, index) => {
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
    resumeIndex
  ].includes(index) && !arg.startsWith("--");
});
if (!resume && !promptFile && promptParts.length === 0) {
  console.error("Error: \u7F3A\u5C11 prompt \u8F93\u5165");
  process.exit(1);
}
var stateStore = createStateStore(process.cwd());
var resumedState = resume ? stateStore.load() : null;
var cliConfig = loadCliConfig({ cwd: process.cwd() });
var controller = new AbortController;
var cancelRun = () => {
  controller.abort();
};
process.on("SIGINT", cancelRun);
process.on("SIGTERM", cancelRun);
if (resume && !resumedState) {
  console.error("Error: \u5F53\u524D\u76EE\u5F55\u6CA1\u6709\u53EF\u6062\u590D\u7684 active-run \u72B6\u6001");
  process.exit(1);
}
var result = await runLoop({
  cwd: process.cwd(),
  agent: {
    type: resumedState?.agent ?? agent,
    model: resumedState?.model ?? model,
    extraFlags: passthroughArgs
  },
  prompt: resumedState?.prompt ?? {
    text: promptParts.join(" ") || undefined,
    filePath: promptFile,
    append: appendPrompt
  },
  completion: resumedState?.completion ?? {
    success: completionPromise,
    abort: abortPromise,
    maxIterations
  },
  runtime: {
    heartbeatIntervalMs: 1e4,
    iterationDelayMs: 1000,
    inactivityTimeoutMs,
    cancelSignal: controller.signal
  },
  reporter: createConsoleReporter({
    colors: cliConfig.colors,
    forceColor: process.env.FORCE_COLOR === "1" ? true : undefined
  })
});
process.off("SIGINT", cancelRun);
process.off("SIGTERM", cancelRun);
if (result.status === "aborted")
  process.exit(2);
if (result.status === "timed-out")
  process.exit(124);
if (result.status === "cancelled")
  process.exit(130);
