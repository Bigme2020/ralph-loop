import { describe, expect, it } from "bun:test";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("install 脚本集成行为", () => {
  it("通过 TypeScript 安装器创建全局命令链接", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ralph-install-"));
    const tempHome = join(tempRoot, "home");
    const tempBin = join(tempRoot, "bin");

    const proc = Bun.spawn(
      [Bun.which("bun")!, "run", join(process.cwd(), "bin", "install.ts")],
      {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          HOME: tempHome,
          RALPH_BIN_DIR: tempBin,
        },
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    const loopLink = join(tempBin, "ralph-loop");
    const openspecLink = join(tempBin, "ralph-run-openspec");

    expect(exitCode).toBe(0);
    expect(stdout).toContain("ralph-loop");
    expect(lstatSync(loopLink).isFile()).toBeTrue();
    expect(lstatSync(openspecLink).isFile()).toBeTrue();
    expect(readFileSync(loopLink, "utf8")).toContain(`exec bun run "${join(process.cwd(), "bin", "ralph-loop.ts")}" "$@"`);
    expect(readFileSync(openspecLink, "utf8")).toContain(`exec bun run "${join(process.cwd(), "bin", "ralph-run-openspec.ts")}" "$@"`);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("支持用于 curl 或 clone 场景的 shell 安装包装脚本", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ralph-install-"));
    const tempHome = join(tempRoot, "home");
    const tempBin = join(tempRoot, "bin");

    const proc = Bun.spawn(
      ["bash", join(process.cwd(), "install.sh")],
      {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          HOME: tempHome,
          RALPH_BIN_DIR: tempBin,
        },
      },
    );

    const exitCode = await proc.exited;
    const openspecLink = join(tempBin, "ralph-run-openspec");

    expect(exitCode).toBe(0);
    expect(lstatSync(openspecLink).isFile()).toBeTrue();

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
