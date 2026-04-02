import { claudeCodeAdapter } from "./claude-code";
import { codexAdapter } from "./codex";
import { copilotAdapter } from "./copilot";
import { opencodeAdapter } from "./opencode";
import type { AgentAdapter, AgentType } from "./types";

const adapters: Record<AgentType, AgentAdapter> = {
  opencode: opencodeAdapter,
  "claude-code": claudeCodeAdapter,
  codex: codexAdapter,
  copilot: copilotAdapter,
};

export function getAgentAdapter(type: AgentType): AgentAdapter {
  return adapters[type];
}

export function getAgentBinaryOverride(type: AgentType, env: Record<string, string | undefined> = process.env): string | undefined {
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

export function resolveCommand(binaryName: string, override?: string): string {
  if (override) return override;

  if (process.platform === "win32" && !Bun.which(binaryName)) {
    const cmdBinary = `${binaryName}.cmd`;
    if (Bun.which(cmdBinary)) return cmdBinary;
  }

  return binaryName;
}
