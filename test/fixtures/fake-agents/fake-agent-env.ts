#!/usr/bin/env bun

const prompt = process.argv.slice(2).join(" ");

console.log(`env:${process.env.RALPH_TEST_ENV ?? "missing"}`);
console.log(`prompt:${prompt}`);
console.log("<promise>COMPLETE</promise>");
