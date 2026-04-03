import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import type { AgentType } from "../agents/types";

export type RunStatus =
  | "running"
  | "completed"
  | "aborted"
  | "timed-out"
  | "cancelled"
  | "max-iterations"
  | "crashed";

export interface IterationAuditRecord {
  iteration: number;
  exitCode: number;
  completed: boolean;
  tools: Record<string, number>;
  askedQuestion: boolean;
  answerProvided: boolean;
  answerLength?: number;
}

export interface RunAuditRecord {
  runId: string;
  startedAt: string;
  endedAt?: string;
  cwd: string;
  agent: AgentType;
  model?: string;
  promptSource: string;
  promptLength: number;
  status: RunStatus;
  completedIterations?: number;
  summary?: string;
  iterations: IterationAuditRecord[];
}

interface RunHistoryEntry {
  runId: string;
  startedAt: string;
  endedAt: string;
  cwd: string;
  agent: AgentType;
  model?: string;
  status: Exclude<RunStatus, "running">;
  completedIterations: number;
  summary: string;
}

export interface AuditStore {
  createRunId(): string;
  initialize(record: RunAuditRecord): void;
  appendIteration(runId: string, iteration: IterationAuditRecord): void;
  finalize(runId: string, terminal: { endedAt: string; status: Exclude<RunStatus, "running">; completedIterations: number; summary: string }): void;
}

function formatRunIdTimestamp(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildSummary(status: Exclude<RunStatus, "running">, context: { iteration: number; promise?: string; maxIterations?: number }): string {
  switch (status) {
    case "completed":
      return `completed after ${context.iteration} iterations`;
    case "aborted":
      return `aborted after ${context.iteration} iterations via ${context.promise ?? "ABORT"}`;
    case "timed-out":
      return `timed out at iteration ${context.iteration}`;
    case "cancelled":
      return `cancelled at iteration ${context.iteration}`;
    case "max-iterations":
      return `stopped at max iterations ${context.maxIterations ?? context.iteration}`;
    case "crashed":
      return `crashed during iteration ${context.iteration}`;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function createAuditStore(cwd: string, stateDirName = ".ralph-loop"): AuditStore {
  const stateDir = join(cwd, stateDirName);
  const runsDir = join(stateDir, "runs");
  const historyPath = join(stateDir, "history.jsonl");

  const getRunPath = (runId: string) => join(runsDir, `${runId}.json`);

  const readRun = (runId: string): RunAuditRecord => {
    return JSON.parse(readFileSync(getRunPath(runId), "utf8")) as RunAuditRecord;
  };

  const ensureDirs = () => {
    mkdirSync(runsDir, { recursive: true });
  };

  return {
    createRunId() {
      return `${formatRunIdTimestamp(new Date())}-${randomBytes(3).toString("hex")}`;
    },
    initialize(record) {
      ensureDirs();
      writeJsonFile(getRunPath(record.runId), record);
    },
    appendIteration(runId, iteration) {
      const record = readRun(runId);
      record.iterations.push(iteration);
      writeJsonFile(getRunPath(runId), record);
    },
    finalize(runId, terminal) {
      const record = readRun(runId);
      record.endedAt = terminal.endedAt;
      record.status = terminal.status;
      record.completedIterations = terminal.completedIterations;
      record.summary = terminal.summary;
      writeJsonFile(getRunPath(runId), record);

      const historyEntry: RunHistoryEntry = {
        runId: record.runId,
        startedAt: record.startedAt,
        endedAt: terminal.endedAt,
        cwd: record.cwd,
        agent: record.agent,
        model: record.model,
        status: terminal.status,
        completedIterations: terminal.completedIterations,
        summary: terminal.summary,
      };

      const previous = existsSync(historyPath) ? readFileSync(historyPath, "utf8") : "";
      writeFileSync(historyPath, `${previous}${JSON.stringify(historyEntry)}\n`, "utf8");
    },
  };
}

export function createRunSummary(status: Exclude<RunStatus, "running">, context: { iteration: number; promise?: string; maxIterations?: number }): string {
  return buildSummary(status, context);
}
