import { appendExtraFlags, defaultDetectQuestion, defaultNormalizeOutput, defaultParseToolName } from "./shared";
import type { AgentAdapter } from "./types";

export const copilotAdapter: AgentAdapter = {
  type: "copilot",
  binaryName: "copilot",
  buildArgs(prompt, options) {
    const args = ["-p", prompt];
    if (options.model) args.push("--model", options.model);
    if (options.allowAllPermissions) args.push("--allow-all", "--no-ask-user");
    return appendExtraFlags(args, options);
  },
  parseToolName: defaultParseToolName,
  normalizeOutput: defaultNormalizeOutput,
  detectQuestion: defaultDetectQuestion,
};
