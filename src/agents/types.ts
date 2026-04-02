export type AgentType = "opencode" | "claude-code" | "codex" | "copilot";

export interface AgentBuildOptions {
  model?: string;
  allowAllPermissions?: boolean;
  extraFlags?: string[];
}

export interface AgentAdapter {
  type: AgentType;
  binaryName: string;
  buildArgs(prompt: string, options: AgentBuildOptions): string[];
  buildEnv?(options: AgentBuildOptions): Record<string, string>;
  parseToolName(line: string): string | null;
  normalizeOutput(output: string): string;
  detectQuestion(output: string): string | null;
}
