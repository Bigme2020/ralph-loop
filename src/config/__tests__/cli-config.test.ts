import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { loadCliConfig } from "../cli-config";

describe("cli config 模块", () => {
  it("按默认值、全局配置、项目配置顺序合并颜色", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-config-"));
    const homeDir = mkdtempSync(join(tmpdir(), "ralph-loop-home-"));
    mkdirSync(join(homeDir, ".ralph-loop"), { recursive: true });
    mkdirSync(join(cwd, ".ralph-loop"), { recursive: true });

    writeFileSync(
      join(homeDir, ".ralph-loop", "config.jsonc"),
      `{
        // global defaults
        "colors": {
          "core": "magenta",
          "agentStdout": "green"
        }
      }`,
      "utf8",
    );

    writeFileSync(
      join(cwd, ".ralph-loop", "config.jsonc"),
      `{
        "colors": {
          "agentStdout": "blue",
          "agentStderr": "red"
        }
      }`,
      "utf8",
    );

    const config = loadCliConfig({ cwd, homeDir });

    expect(config.colors).toEqual({
      core: "magenta",
      agentStdout: "blue",
      agentStderr: "red",
    });

    rmSync(cwd, { recursive: true, force: true });
    rmSync(homeDir, { recursive: true, force: true });
  });

  it("在配置缺失或颜色值非法时回退到内置默认值", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ralph-loop-config-"));
    mkdirSync(join(cwd, ".ralph-loop"), { recursive: true });

    writeFileSync(
      join(cwd, ".ralph-loop", "config.jsonc"),
      `{
        "colors": {
          "core": "invalid",
          "agentStdout": "green"
        }
      }`,
      "utf8",
    );

    const config = loadCliConfig({ cwd, homeDir: homedir() });

    expect(config.colors).toEqual({
      core: "cyan",
      agentStdout: "green",
      agentStderr: "yellow",
    });

    rmSync(cwd, { recursive: true, force: true });
  });
});
