import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvePromptText } from "../prompt-source";

describe("prompt source 模块", () => {
  it("在提供 inline 文本时直接使用该文本", () => {
    expect(resolvePromptText({ text: "hello" })).toBe("hello");
  });

  it("读取 prompt 文件并追加运行时文本", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ralph-loop-prompt-"));
    const promptPath = join(tempDir, "prompt.md");
    writeFileSync(promptPath, "base prompt\n", "utf8");

    expect(resolvePromptText({ filePath: promptPath, append: "runtime" })).toBe("base prompt\n\nruntime");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("在没有提供任何 prompt 输入时抛错", () => {
    expect(() => resolvePromptText({})).toThrow("必须提供 prompt 文本或 prompt 文件");
  });

  it("在 prompt 文件不存在时抛错", () => {
    expect(() => resolvePromptText({ filePath: "/tmp/does-not-exist.md" })).toThrow("prompt 文件不存在");
  });

  it("在 prompt 路径是目录时抛错", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ralph-loop-prompt-dir-"));
    const promptDir = join(tempDir, "prompt-dir");
    mkdirSync(promptDir);

    expect(() => resolvePromptText({ filePath: promptDir })).toThrow("prompt 路径不是文件");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("在 prompt 文件为空时抛错", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ralph-loop-prompt-empty-"));
    const promptPath = join(tempDir, "prompt.md");
    writeFileSync(promptPath, "  \n", "utf8");

    expect(() => resolvePromptText({ filePath: promptPath })).toThrow("prompt 文件为空");

    rmSync(tempDir, { recursive: true, force: true });
  });
});
