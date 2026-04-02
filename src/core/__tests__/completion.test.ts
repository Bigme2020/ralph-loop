import { describe, expect, it } from "bun:test";

import { checkTerminalPromise, getLastNonEmptyLine, stripAnsi } from "../completion";

describe("completion 模块", () => {
  it("返回去除空行后的最后一行内容", () => {
    expect(getLastNonEmptyLine("a\n\n  b  \n")).toBe("b");
  });

  it("在检查完成信号前去除 ANSI 颜色码", () => {
    expect(stripAnsi("\u001b[32mhello\u001b[0m")).toBe("hello");
  });

  it("接受最后一行的终止 promise", () => {
    expect(checkTerminalPromise("work\n<promise>COMPLETE</promise>", "COMPLETE")).toBeTrue();
  });

  it("拒绝不是最后一个非空行的 promise", () => {
    expect(checkTerminalPromise("<promise>COMPLETE</promise>\nextra", "COMPLETE")).toBeFalse();
  });

  it("以大小写不敏感方式匹配 promise 内容", () => {
    expect(checkTerminalPromise("<promise>complete</promise>", "COMPLETE")).toBeTrue();
  });
});
