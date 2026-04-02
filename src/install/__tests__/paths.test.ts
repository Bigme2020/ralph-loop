import { describe, expect, it } from "bun:test";

import { getCommandLinks, getLauncherScript, getPathExportHint, resolveGlobalBinDir } from "../paths";

describe("install paths 模块", () => {
  it("默认使用 ~/.bun/bin 作为全局 bin 目录", () => {
    expect(resolveGlobalBinDir("/tmp/home", {})).toBe("/tmp/home/.bun/bin");
  });

  it("允许覆盖全局 bin 目录", () => {
    expect(resolveGlobalBinDir("/tmp/home", { RALPH_BIN_DIR: "/tmp/custom-bin" })).toBe("/tmp/custom-bin");
  });

  it("返回两个命令的链接信息", () => {
    expect(getCommandLinks("/repo", "/bin")).toEqual([
      {
        commandName: "ralph-loop",
        sourcePath: "/repo/bin/ralph-loop.ts",
        targetPath: "/bin/ralph-loop",
      },
      {
        commandName: "ralph-run-openspec",
        sourcePath: "/repo/bin/ralph-run-openspec.ts",
        targetPath: "/bin/ralph-run-openspec",
      },
    ]);
  });

  it("当 bin 目录不在 PATH 中时返回导出提示", () => {
    expect(getPathExportHint("/tmp/bin", "/usr/bin:/bin")).toContain("export PATH=\"/tmp/bin:$PATH\"");
  });

  it("当目录已经在 PATH 中时不返回提示", () => {
    expect(getPathExportHint("/tmp/bin", "/usr/bin:/tmp/bin:/bin")).toBeNull();
  });

  it("生成通过 bun run 分发的 launcher 脚本", () => {
    expect(getLauncherScript("/repo/bin/ralph-loop.ts")).toContain('exec bun run "/repo/bin/ralph-loop.ts" "$@"');
  });
});
