#!/usr/bin/env bun

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const logPath = process.argv[2];
const prompt = process.argv.slice(3).join(" ");

if (!existsSync(logPath)) {
  writeFileSync(logPath, "", "utf8");
}

appendFileSync(logPath, `${prompt}\n---\n`, "utf8");

const previous = readFileSync(logPath, "utf8");
if (previous.includes("## 上一轮交互回答")) {
  console.log("<promise>COMPLETE</promise>");
} else {
  console.log("|  question Should I continue?");
}
