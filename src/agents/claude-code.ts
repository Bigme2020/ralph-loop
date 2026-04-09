import { appendExtraFlags, defaultDetectQuestion } from "./shared";
import type { AgentAdapter } from "./types";

interface ClaudeTextBlock {
  type?: string;
  text?: string;
}

interface ClaudeJsonPayload {
  text?: string;
  content?: string;
  message?: {
    content?: ClaudeTextBlock[];
  };
  result?: string;
}

function collectTextCandidate(results: string[], value?: string) {
  if (value?.trim()) {
    results.push(value.trim());
  }
}

function extractDisplayLines(output: string): string[] {
  const results: string[] = [];

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      if (trimmed) results.push(trimmed);
      continue;
    }

    try {
      const payload = JSON.parse(trimmed) as ClaudeJsonPayload;
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
      if (trimmed) results.push(trimmed);
    }
  }

  return results;
}

export const claudeCodeAdapter: AgentAdapter = {
  type: "claude-code",
  binaryName: "claude",
  buildArgs(prompt, options) {
    const args = ["-p", prompt];
    if (options.model) args.push("--model", options.model);
    if (options.allowAllPermissions) args.push("--dangerously-skip-permissions");
    return appendExtraFlags(args, options);
  },
  parseToolName(line) {
    const cleanLine = line.trim();
    const match = cleanLine.match(/(?:Using|Called|Tool:)\s+([A-Za-z0-9_.-]+)/i);
    return match ? match[1] : null;
  },
  normalizeOutput(output) {
    return extractDisplayLines(output).join("\n");
  },
  detectQuestion(output) {
    return defaultDetectQuestion(extractDisplayLines(output).join("\n"));
  },
};
