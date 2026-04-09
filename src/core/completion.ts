export function stripAnsi(input: string): string {
  return input
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "");
}

function stripTrailingNoise(input: string): string {
  return stripAnsi(input)
    .replace(/[\u200B-\u200D\u2060\uFEFF]+$/g, "")
    .replace(/[\b\u0000]+$/g, "")
    .trimEnd();
}

export function getLastNonEmptyLine(output: string): string | null {
  const lines = stripTrailingNoise(output)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines[lines.length - 1] : null;
}

export function checkTerminalPromise(output: string, promise: string): boolean {
  const escaped = promise.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const terminalPromisePattern = new RegExp(`^<promise>\\s*${escaped}\\s*</promise>$`, "i");
  const normalized = stripTrailingNoise(output).replace(/\r\n/g, "\n").trim();

  const lastLine = getLastNonEmptyLine(normalized);
  if (lastLine && terminalPromisePattern.test(lastLine)) {
    return true;
  }

  return new RegExp("```(?:\\w+)?\\n\\s*<promise>\\s*" + escaped + "\\s*</promise>\\s*\\n```$", "i").test(normalized);
}
