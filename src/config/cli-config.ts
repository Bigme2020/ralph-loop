import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CLI_COLOR_NAMES = ["default", "gray", "blue", "cyan", "green", "yellow", "red", "magenta"] as const;

export type CliColorName = (typeof CLI_COLOR_NAMES)[number];

export interface CliColorsConfig {
  core: CliColorName;
  agentStdout: CliColorName;
  agentStderr: CliColorName;
}

export interface CliConfig {
  colors: CliColorsConfig;
}

export const DEFAULT_CLI_CONFIG: CliConfig = {
  colors: {
    core: "cyan",
    agentStdout: "default",
    agentStderr: "yellow",
  },
};

interface LoadCliConfigOptions {
  cwd: string;
  homeDir?: string;
}

function stripJsonComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s+)\/\/.*$/gm, "$1");
}

function isColorName(value: unknown): value is CliColorName {
  return typeof value === "string" && CLI_COLOR_NAMES.includes(value as CliColorName);
}

function parseConfigFile(filePath: string): Partial<CliConfig> {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(stripJsonComments(readFileSync(filePath, "utf8"))) as Partial<CliConfig>;
  } catch {
    return {};
  }
}

function mergeColors(base: CliColorsConfig, source: Partial<CliColorsConfig> | undefined): CliColorsConfig {
  if (!source) {
    return base;
  }

  return {
    core: isColorName(source.core) ? source.core : base.core,
    agentStdout: isColorName(source.agentStdout) ? source.agentStdout : base.agentStdout,
    agentStderr: isColorName(source.agentStderr) ? source.agentStderr : base.agentStderr,
  };
}

export function loadCliConfig(options: LoadCliConfigOptions): CliConfig {
  const globalConfig = parseConfigFile(join(options.homeDir ?? homedir(), ".ralph-loop", "config.jsonc"));
  const projectConfig = parseConfigFile(join(options.cwd, ".ralph-loop", "config.jsonc"));

  return {
    colors: mergeColors(
      mergeColors(DEFAULT_CLI_CONFIG.colors, globalConfig.colors),
      projectConfig.colors,
    ),
  };
}
