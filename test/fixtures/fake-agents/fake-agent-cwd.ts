#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const outputPath = join(process.cwd(), "cwd-log.txt");

writeFileSync(outputPath, process.cwd(), "utf8");
console.log("<promise>COMPLETE</promise>");
