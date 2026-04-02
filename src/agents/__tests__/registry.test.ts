import { describe, expect, it, mock } from "bun:test";

import { getAgentAdapter, getAgentBinaryOverride, resolveCommand } from "../registry";

describe("agent registry 模块", () => {
  it("为 opencode 构造包含 prompt 文本的参数", () => {
    const adapter = getAgentAdapter("opencode");
    expect(adapter.buildArgs("hello", { model: "anthropic/claude-sonnet-4.5" })).toEqual([
      "run",
      "-m",
      "anthropic/claude-sonnet-4.5",
      "hello",
    ]);
  });

  it("为 claude-code 在允许全部权限时构造参数", () => {
    const adapter = getAgentAdapter("claude-code");
    expect(adapter.buildArgs("hello", { model: "claude-sonnet-4", allowAllPermissions: true })).toEqual([
      "-p",
      "hello",
      "--model",
      "claude-sonnet-4",
      "--dangerously-skip-permissions",
    ]);
  });

  it("解析命令时保留显式传入的二进制覆盖", () => {
    expect(resolveCommand("opencode", "/custom/opencode")).toBe("/custom/opencode");
  });

  it("按 agent 类型读取对应的二进制覆盖环境变量", () => {
    expect(getAgentBinaryOverride("opencode", { RALPH_OPENCODE_BINARY: "/tmp/opencode" })).toBe("/tmp/opencode");
    expect(getAgentBinaryOverride("claude-code", { RALPH_CLAUDE_BINARY: "/tmp/claude" })).toBe("/tmp/claude");
  });

  it("在 Windows 上回退到 .cmd 可执行文件", () => {
    const originalPlatform = process.platform;
    const originalWhich = Bun.which;

    Object.defineProperty(process, "platform", { value: "win32" });
    Bun.which = mock((binaryName: string) => {
      if (binaryName === "opencode") return null;
      if (binaryName === "opencode.cmd") return "C:/tools/opencode.cmd";
      return null;
    });

    expect(resolveCommand("opencode")).toBe("opencode.cmd");

    Object.defineProperty(process, "platform", { value: originalPlatform });
    Bun.which = originalWhich;
  });
});
