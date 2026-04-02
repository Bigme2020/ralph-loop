import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("全局命令冒烟测试", () => {
  it("在不加 bun run 前缀时运行已安装的全局命令", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ralph-global-"));
    const tempHome = join(tempRoot, "home");
    const tempBin = join(tempRoot, "bin");

    const installProc = Bun.spawn([Bun.which("bun")!, "run", join(process.cwd(), "bin", "install.ts")], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOME: tempHome,
        RALPH_BIN_DIR: tempBin,
      },
    });
    await installProc.exited;

    const proc = Bun.spawn([join(tempBin, "ralph-run-openspec"), "--help"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${tempBin}:${process.env.PATH ?? ""}`,
      },
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: ralph-run-openspec");

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
