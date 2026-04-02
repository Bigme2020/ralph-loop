import type { AgentBuildOptions } from "./types";

export function appendExtraFlags(args: string[], options: AgentBuildOptions): string[] {
  if (options.extraFlags?.length) {
    args.push(...options.extraFlags);
  }
  return args;
}

export function defaultNormalizeOutput(output: string): string {
  return output;
}

export function defaultDetectQuestion(output: string): string | null {
  const match = output.match(/(?:question|asking|please confirm|do you want|should i|can i)\s*[:\-]?\s*(.+)/i);
  return match ? match[1].trim() : null;
}

export function defaultParseToolName(line: string): string | null {
  const match = line.match(/(?:Tool:|Using|Calling|Running)\s+([A-Za-z0-9_.-]+)/i);
  return match ? match[1] : null;
}
