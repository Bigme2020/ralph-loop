import type { LoopReporter, ReporterEventContext } from "../core/types";

function formatIterationLabel(context: ReporterEventContext): string {
  if (context.maxIterations && context.maxIterations > 0) {
    return `${context.iteration}/${context.maxIterations}`;
  }

  return `${context.iteration}`;
}

export function createConsoleReporter(): LoopReporter {
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
    onStdoutChunk(chunk) {
      process.stdout.write(chunk);
    },
    onStderrChunk(chunk) {
      process.stderr.write(chunk);
    },
    onHeartbeat(context) {
      console.log(`heartbeat: elapsed ${context.elapsedMs}ms, idle ${context.idleMs}ms`);
    },
    onIterationEnd(context) {
      console.log(`iteration ${formatIterationLabel(context)} exit=${context.exitCode} completed=${context.completed}`);
      const tools = Object.entries(context.toolCounts);
      if (tools.length > 0) {
        console.log(`tools: ${tools.map(([name, count]) => `${name}=${count}`).join(", ")}`);
      }
    },
    onComplete(context) {
      console.log(`complete after iteration ${formatIterationLabel(context)}`);
    },
    onAbort(context) {
      console.log(`abort after iteration ${formatIterationLabel(context)} via ${context.promise}`);
    },
    onTimeout(context) {
      console.log(
        `timeout after iteration ${formatIterationLabel(context)} idle=${context.idleMs}ms limit=${context.timeoutMs}ms`,
      );
      if (context.resumeHint) {
        console.log(`resume: ${context.resumeHint}`);
      }
    },
    onCancelled(context) {
      console.log(`cancelled after iteration ${formatIterationLabel(context)}`);
    },
  };
}
