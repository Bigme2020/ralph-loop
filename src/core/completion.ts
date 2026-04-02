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
  const lastLine = getLastNonEmptyLine(output);
  if (!lastLine) return false;

  const escaped = promise.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^<promise>\\s*${escaped}\\s*</promise>$`, "i").test(lastLine);
}
