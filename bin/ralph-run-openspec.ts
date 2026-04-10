#!/usr/bin/env bun

import { runOpenSpecWrapper } from "../openspec-wrapper";
import type { AgentType } from "../src/agents/types";

function usage(): void {
  console.log(`Usage: ralph-run-openspec --change-id <CHANGE_ID> [--max-iterations <N>] [--model <MODEL>] [--reasoning-level <LEVEL>] [--agent <AGENT>] [-- <agent-extra-args...>]

Options:
  -h, --help                 Show this help message
  --change-id <CHANGE_ID>    OpenSpec change ID to run
  --max-iterations <N>       Maximum iteration count
  --model <MODEL>            Model passed to ralph-loop
  --reasoning-level <LEVEL>  Reasoning level shown in output
  --agent <AGENT>            Agent passed to ralph-loop (default: opencode)
`);
}

const argv = process.argv.slice(2);
const passthroughIndex = argv.indexOf("--");
const passthroughArgs = passthroughIndex >= 0 ? argv.slice(passthroughIndex + 1) : [];
const args = passthroughIndex >= 0 ? argv.slice(0, passthroughIndex) : argv;

let changeId = "";
let maxIterations: number | undefined;
let model: string | undefined;
let reasoningLevel: string | undefined;
let agent: AgentType = "opencode";

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case "-h":
    case "--help":
      usage();
      process.exit(0);
    case "--change-id":
      changeId = args[++i] ?? "";
      break;
    case "--max-iterations":
      maxIterations = Number(args[++i]);
      break;
    case "--model":
      model = args[++i];
      break;
    case "--reasoning-level":
      reasoningLevel = args[++i];
      break;
    case "--agent":
      agent = (args[++i] as AgentType | undefined) ?? "opencode";
      break;
    default:
      if (arg.startsWith("--change-id=")) {
        changeId = arg.slice("--change-id=".length);
      } else if (arg.startsWith("--max-iterations=")) {
        maxIterations = Number(arg.slice("--max-iterations=".length));
      } else if (arg.startsWith("--model=")) {
        model = arg.slice("--model=".length);
      } else if (arg.startsWith("--reasoning-level=")) {
        reasoningLevel = arg.slice("--reasoning-level=".length);
      } else if (arg.startsWith("--agent=")) {
        agent = arg.slice("--agent=".length) as AgentType;
      } else {
        console.error(`Error: unknown option: ${arg}`);
        usage();
        process.exit(1);
      }
  }
}

if (!changeId) {
  console.error("Error: --change-id is required");
  usage();
  process.exit(1);
}

if (maxIterations !== undefined && (!Number.isInteger(maxIterations) || maxIterations <= 0)) {
  console.error(`Error: MAX_ITERATIONS must be a positive integer: ${maxIterations}`);
  process.exit(1);
}

await runOpenSpecWrapper({
  repoRoot: process.cwd(),
  changeId,
  agent,
  model,
  reasoningLevel,
  maxIterations,
  extraArgs: passthroughArgs,
});
