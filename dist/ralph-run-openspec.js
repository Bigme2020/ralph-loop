#!/usr/bin/env bun
// @bun

// bin/ralph-run-openspec.ts
import { join as join4 } from "path";

// openspec-wrapper/index.ts
import { existsSync as existsSync3, readdirSync } from "fs";
import { join as join3 } from "path";

// src/core/completion.ts
function stripAnsi(input) {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}
function getLastNonEmptyLine(output) {
  const lines = stripAnsi(output).replace(/\r\n/g, `
`).split(`
`).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
}
function checkTerminalPromise(output, promise) {
  const lastLine = getLastNonEmptyLine(output);
  if (!lastLine)
    return false;
  const escaped = promise.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^<promise>\\s*${escaped}\\s*</promise>$`, "i").test(lastLine);
}
// src/core/prompt-source.ts
import { existsSync, readFileSync, statSync } from "fs";
function resolvePromptText(input) {
  const parts = [];
  if (input.filePath) {
    if (!existsSync(input.filePath)) {
      throw new Error(`prompt \u6587\u4EF6\u4E0D\u5B58\u5728: ${input.filePath}`);
    }
    if (!statSync(input.filePath).isFile()) {
      throw new Error(`prompt \u8DEF\u5F84\u4E0D\u662F\u6587\u4EF6: ${input.filePath}`);
    }
    const content = readFileSync(input.filePath, "utf8").trim();
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

// src/core/state-store.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, rmSync, writeFileSync } from "fs";
import { join } from "path";
function createStateStore(cwd, stateDirName = ".ralph-loop") {
  const stateDir = join(cwd, stateDirName);
  const statePath = join(stateDir, "active-run.json");
  return {
    stateDir,
    statePath,
    load() {
      if (!existsSync2(statePath)) {
        return null;
      }
      try {
        return JSON.parse(readFileSync2(statePath, "utf8"));
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
      if (existsSync2(statePath)) {
        rmSync(statePath, { force: true });
      }
    }
  };
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
      const content = payload.message?.content ?? [];
      for (const block of content) {
        if (block.type === "text" && block.text?.trim()) {
          results.push(block.text.trim());
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
    env: {
      ...process.env,
      ...adapter.buildEnv?.(options) ?? {}
    }
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const startedAt = Date.now();
  let lastActivityAt = Date.now();
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
      onChunk(text);
    }
  };
  const heartbeatIntervalMs = runtime.heartbeatIntervalMs ?? 1e4;
  const timer = setInterval(() => {
    const now = Date.now();
    runtime.onHeartbeat?.({
      elapsedMs: now - startedAt,
      idleMs: now - lastActivityAt
    });
    if (runtime.inactivityTimeoutMs && now - lastActivityAt >= runtime.inactivityTimeoutMs) {
      timedOut = true;
      try {
        proc.kill();
      } catch {}
    }
  }, heartbeatIntervalMs);
  await Promise.all([
    readStream(proc.stdout, (chunk) => {
      stdout += chunk;
    }),
    readStream(proc.stderr, (chunk) => {
      stderr += chunk;
    }),
    proc.exited
  ]);
  clearInterval(timer);
  return {
    stdout,
    stderr,
    exitCode: proc.exitCode ?? (timedOut ? 124 : 1),
    timedOut
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
async function runLoop(options) {
  const stateStore = createStateStore(options.cwd);
  const state = createInitialState(options);
  const maxIterations = options.completion.maxIterations ?? 0;
  const minIterations = options.completion.minIterations ?? 1;
  const promptSource = options.prompt.filePath ?? "inline";
  options.reporter?.onRunStart?.({
    agent: options.agent.type,
    model: options.agent.model,
    promptSource
  });
  stateStore.save(state);
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
      onHeartbeat: ({ elapsedMs, idleMs }) => {
        options.reporter?.onHeartbeat?.({
          iteration: state.iteration,
          maxIterations: maxIterations || undefined,
          elapsedMs,
          idleMs
        });
      }
    });
    const normalized = adapter.normalizeOutput(`${result.stdout}
${result.stderr}`);
    const success = checkTerminalPromise(normalized, options.completion.success);
    const abort = options.completion.abort ? checkTerminalPromise(normalized, options.completion.abort) : false;
    options.reporter?.onIterationEnd?.({
      iteration: state.iteration,
      maxIterations: maxIterations || undefined,
      exitCode: result.exitCode,
      completed: success
    });
    if (result.timedOut) {
      stateStore.clear();
      options.reporter?.onTimeout?.({
        iteration: state.iteration,
        maxIterations: maxIterations || undefined,
        idleMs: options.runtime?.inactivityTimeoutMs ?? 0,
        timeoutMs: options.runtime?.inactivityTimeoutMs ?? 0
      });
      return { status: "timed-out", completedIterations: state.iteration };
    }
    if (abort) {
      stateStore.clear();
      options.reporter?.onAbort?.({
        iteration: state.iteration,
        maxIterations: maxIterations || undefined,
        promise: options.completion.abort
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
          append: undefined
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
// src/ui/console-reporter.ts
function formatIterationLabel(context) {
  if (context.maxIterations && context.maxIterations > 0) {
    return `${context.iteration}/${context.maxIterations}`;
  }
  return `${context.iteration}`;
}
function createConsoleReporter() {
  return {
    onRunStart(summary) {
      console.log("== Ralph Loop ==");
      console.log(`Agent: ${summary.agent}`);
      if (summary.model) {
        console.log(`Model: ${summary.model}`);
      }
      console.log(`Prompt source: ${summary.promptSource}`);
      console.log("");
    },
    onIterationStart(context) {
      console.log(`-- Iteration ${formatIterationLabel(context)} --`);
    },
    onHeartbeat(context) {
      console.log(`heartbeat: elapsed ${context.elapsedMs}ms, idle ${context.idleMs}ms`);
    },
    onIterationEnd(context) {
      console.log(`iteration ${formatIterationLabel(context)} exit=${context.exitCode} completed=${context.completed}`);
    },
    onComplete(context) {
      console.log(`complete after iteration ${formatIterationLabel(context)}`);
    },
    onAbort(context) {
      console.log(`abort after iteration ${formatIterationLabel(context)} via ${context.promise}`);
    },
    onTimeout(context) {
      console.log(`timeout after iteration ${formatIterationLabel(context)} idle=${context.idleMs}ms limit=${context.timeoutMs}ms`);
    }
  };
}
// src/install/paths.ts
import { join as join2 } from "path";
function getLauncherScript(sourcePath) {
  return `#!/usr/bin/env bash
set -euo pipefail

exec bun run "${sourcePath}" "$@"
`;
}
function resolveGlobalBinDir(homeDir, env) {
  return env.RALPH_BIN_DIR ?? join2(homeDir, ".bun", "bin");
}
function getCommandLinks(repoRoot, globalBinDir) {
  return [
    {
      commandName: "ralph-loop",
      sourcePath: join2(repoRoot, "bin", "ralph-loop.ts"),
      targetPath: join2(globalBinDir, "ralph-loop")
    },
    {
      commandName: "ralph-run-openspec",
      sourcePath: join2(repoRoot, "bin", "ralph-run-openspec.ts"),
      targetPath: join2(globalBinDir, "ralph-run-openspec")
    }
  ];
}
function getPathExportHint(globalBinDir, currentPath) {
  const pathEntries = (currentPath ?? "").split(":").filter(Boolean);
  if (pathEntries.includes(globalBinDir)) {
    return null;
  }
  return `export PATH="${globalBinDir}:$PATH"`;
}
// openspec-wrapper/index.ts
function buildOpenSpecPrompt(changeDir) {
  return `\u6267\u884C OpenSpec change\uFF1A${changeDir}`;
}
function findSpecFiles(changeDir) {
  const specsDir = join3(changeDir, "specs");
  const result = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join3(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === "spec.md") {
        result.push(fullPath);
      }
    }
  };
  if (!existsSync3(specsDir)) {
    return [];
  }
  walk(specsDir);
  return result;
}
function validateOpenSpecChange(changeDir) {
  const promptFiles = ["proposal.md", "design.md", "tasks.md"];
  for (const name of promptFiles) {
    const fullPath = join3(changeDir, name);
    if (!existsSync3(fullPath)) {
      throw new Error(`missing file: ${fullPath}`);
    }
  }
  const specFiles = findSpecFiles(changeDir);
  if (specFiles.length === 0) {
    throw new Error(`no spec.md found under: ${join3(changeDir, "specs")}`);
  }
}
function assertGitClean(repoRoot) {
  if (process.env.RALPH_SKIP_GIT_CLEAN_CHECK === "1") {
    return;
  }
  const proc = Bun.spawnSync(["git", "-C", repoRoot, "status", "--porcelain"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe"
  });
  if (proc.exitCode === 0 && proc.stdout.toString().trim()) {
    throw new Error("git working tree is not clean.");
  }
}
async function runOpenSpecWrapper(options) {
  const changeDir = join3(options.repoRoot, "openspec", "changes", options.changeId);
  validateOpenSpecChange(changeDir);
  if (!options.skipGitCleanCheck) {
    assertGitClean(options.repoRoot);
  }
  const specFiles = findSpecFiles(changeDir);
  console.log("Found spec files:");
  for (const file of specFiles) {
    console.log(`  - ${file}`);
  }
  console.log("== OpenSpec Ralph Run ==");
  console.log(`Change ID       : ${options.changeId}`);
  console.log(`Change dir      : ${changeDir}`);
  console.log(`Prompt file     : ${options.promptFile}`);
  console.log(`Agent           : ${options.agent}`);
  if (options.maxIterations) {
    console.log(`Max iterations  : ${options.maxIterations}`);
  }
  if (options.model) {
    console.log(`Model           : ${options.model}`);
  }
  console.log("");
  await runLoop({
    cwd: options.repoRoot,
    agent: {
      type: options.agent,
      model: options.model,
      extraFlags: options.extraArgs
    },
    prompt: {
      filePath: options.promptFile,
      append: buildOpenSpecPrompt(changeDir)
    },
    completion: {
      success: "COMPLETE",
      maxIterations: options.maxIterations
    },
    runtime: {
      heartbeatIntervalMs: 1e4,
      iterationDelayMs: 1000
    },
    reporter: createConsoleReporter()
  });
}

// bin/ralph-run-openspec.ts
function usage() {
  console.log(`Usage: ralph-run-openspec --change-id <CHANGE_ID> [--max-iterations <N>] [--model <MODEL>] [--agent <AGENT>] [-- <agent-extra-args...>]

Options:
  -h, --help                 Show this help message
  --change-id <CHANGE_ID>    OpenSpec change ID to run
  --max-iterations <N>       Maximum iteration count
  --model <MODEL>            Model passed to ralph-loop
  --agent <AGENT>            Agent passed to ralph-loop (default: opencode)
`);
}
var argv = process.argv.slice(2);
var passthroughIndex = argv.indexOf("--");
var passthroughArgs = passthroughIndex >= 0 ? argv.slice(passthroughIndex + 1) : [];
var args = passthroughIndex >= 0 ? argv.slice(0, passthroughIndex) : argv;
var changeId = "";
var maxIterations;
var model;
var agent = "opencode";
for (let i = 0;i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case "-h":
    case "--help":
      usage();
      process.exit(0);
    case "--change-id":
      changeId = args[++i] ?? "";
      break;
    case "--max-iterations":
      maxIterations = Number(args[++i]);
      break;
    case "--model":
      model = args[++i];
      break;
    case "--agent":
      agent = args[++i] ?? "opencode";
      break;
    default:
      if (arg.startsWith("--change-id=")) {
        changeId = arg.slice("--change-id=".length);
      } else if (arg.startsWith("--max-iterations=")) {
        maxIterations = Number(arg.slice("--max-iterations=".length));
      } else if (arg.startsWith("--model=")) {
        model = arg.slice("--model=".length);
      } else if (arg.startsWith("--agent=")) {
        agent = arg.slice("--agent=".length);
      } else {
        console.error(`Error: unknown option: ${arg}`);
        usage();
        process.exit(1);
      }
  }
}
if (!changeId) {
  console.error("Error: --change-id is required");
  usage();
  process.exit(1);
}
if (maxIterations !== undefined && (!Number.isInteger(maxIterations) || maxIterations <= 0)) {
  console.error(`Error: MAX_ITERATIONS must be a positive integer: ${maxIterations}`);
  process.exit(1);
}
await runOpenSpecWrapper({
  repoRoot: process.cwd(),
  changeId,
  promptFile: join4(process.cwd(), "openspec-wrapper", "openspec-prompt-file.md"),
  agent,
  model,
  maxIterations,
  extraArgs: passthroughArgs
});
