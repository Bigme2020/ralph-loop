import { appendExtraFlags, defaultDetectQuestion, defaultNormalizeOutput, defaultParseToolName } from "./shared";
import type { AgentAdapter } from "./types";

export const codexAdapter: AgentAdapter = {
  type: "codex",
  binaryName: "codex",
  buildArgs(prompt, options) {
    const args = ["exec"];
    if (options.model) args.push("--model", options.model);
    if (options.allowAllPermissions) args.push("--full-auto");
    appendExtraFlags(args, options);
    args.push(prompt);
    return args;
  },
  parseToolName: defaultParseToolName,
  normalizeOutput: defaultNormalizeOutput,
  detectQuestion: defaultDetectQuestion,
};
