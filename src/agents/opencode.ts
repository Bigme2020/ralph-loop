import { appendExtraFlags, defaultDetectQuestion, defaultNormalizeOutput } from "./shared";
import type { AgentAdapter } from "./types";

export const opencodeAdapter: AgentAdapter = {
  type: "opencode",
  binaryName: "opencode",
  buildArgs(prompt, options) {
    const args = ["run"];
    if (options.model) args.push("-m", options.model);
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
  },
};
