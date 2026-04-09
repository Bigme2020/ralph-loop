import type { LoopReporter, ReporterEventContext } from "../core/types";
import type { CliColorsConfig, CliColorName } from "../config/cli-config";

const ANSI_COLOR_CODES: Record<CliColorName, string> = {
  default: "39",
  gray: "90",
  blue: "34",
  cyan: "36",
  green: "32",
  yellow: "33",
  red: "31",
  magenta: "35",
};

interface WritableStreamLike {
  write(chunk: string): boolean;
}

interface ConsoleReporterOptions {
  colors?: CliColorsConfig;
  forceColor?: boolean;
  stdout?: WritableStreamLike;
  stderr?: WritableStreamLike;
}

function formatIterationLabel(context: ReporterEventContext): string {
  if (context.maxIterations && context.maxIterations > 0) {
    return `${context.iteration}/${context.maxIterations}`;
  }

  return `${context.iteration}`;
}

function supportsColor(forceColor?: boolean): boolean {
  if (typeof forceColor === "boolean") {
    return forceColor;
  }

  return Boolean(process.stdout.isTTY && process.stderr.isTTY);
}

function colorize(text: string, color: CliColorName, enabled: boolean): string {
  if (!enabled || color === "default") {
    return text;
  }

  return `\u001b[${ANSI_COLOR_CODES[color]}m${text}\u001b[0m`;
}

export function createConsoleReporter(options: ConsoleReporterOptions = {}): LoopReporter {
  const colorEnabled = supportsColor(options.forceColor);
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const colors = options.colors;
  const writeCoreLine = (line: string) => {
    stdout.write(`${colorize(line, colors?.core ?? "default", colorEnabled)}\n`);
  };

  return {
    onRunStart(summary) {
      writeCoreLine("== Ralph Loop ==");
      writeCoreLine(`Agent: ${summary.agent}`);
      if (summary.model) {
        writeCoreLine(`Model: ${summary.model}`);
      }
      writeCoreLine(`Prompt source: ${summary.promptSource}`);
      stdout.write("\n");
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
      writeCoreLine(
        `signal ${context.promise} detected at iteration ${formatIterationLabel(context)} but deferred until minIterations=${context.minIterations}`,
      );
    },
    onComplete(context) {
      writeCoreLine(`complete after iteration ${formatIterationLabel(context)}`);
    },
    onAbort(context) {
      writeCoreLine(`abort after iteration ${formatIterationLabel(context)} via ${context.promise}`);
    },
    onTimeout(context) {
      writeCoreLine(
        `timeout after iteration ${formatIterationLabel(context)} idle=${context.idleMs}ms limit=${context.timeoutMs}ms`,
      );
      if (context.resumeHint) {
        writeCoreLine(`resume: ${context.resumeHint}`);
      }
    },
    onCancelled(context) {
      writeCoreLine(`cancelled after iteration ${formatIterationLabel(context)}`);
    },
  };
}
