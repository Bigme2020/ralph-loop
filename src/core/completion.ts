export function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}

export function getLastNonEmptyLine(output: string): string | null {
  const lines = stripAnsi(output)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function checkTerminalPromise(output: string, promise: string): boolean {
  const escaped = promise.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const terminalPromisePattern = new RegExp(`^<promise>\\s*${escaped}\\s*</promise>$`, "i");
  const normalized = stripAnsi(output).replace(/\r\n/g, "\n").trim();

  const lastLine = getLastNonEmptyLine(normalized);
  if (lastLine && terminalPromisePattern.test(lastLine)) {
    return true;
  }

  return new RegExp("```(?:\\w+)?\\n\\s*<promise>\\s*" + escaped + "\\s*</promise>\\s*\\n```$", "i").test(normalized);
}
