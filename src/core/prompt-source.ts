import { existsSync, readFileSync, statSync } from "node:fs";

export interface PromptInput {
  text?: string;
  filePath?: string;
  append?: string;
}

export function resolvePromptText(input: PromptInput): string {
  const parts: string[] = [];

  if (input.filePath) {
    if (!existsSync(input.filePath)) {
      throw new Error(`prompt 文件不存在: ${input.filePath}`);
    }
    if (!statSync(input.filePath).isFile()) {
      throw new Error(`prompt 路径不是文件: ${input.filePath}`);
    }

    const content = readFileSync(input.filePath, "utf8").trim();
    if (!content) {
      throw new Error(`prompt 文件为空: ${input.filePath}`);
    }

    parts.push(content);
  }

  if (input.text?.trim()) {
    parts.push(input.text.trim());
  }

  if (input.append?.trim()) {
    parts.push(input.append.trim());
  }

  if (parts.length === 0) {
    throw new Error("必须提供 prompt 文本或 prompt 文件");
  }

  return parts.join("\n\n");
}
