#!/usr/bin/env bun

const prompt = process.argv.slice(2).join(" ");

console.log(`received: ${prompt}`);
console.log("<promise>COMPLETE</promise>");
