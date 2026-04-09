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

  it("接受被包在最后一个代码块中的终止 promise", () => {
    expect(
      checkTerminalPromise("简短总结：\n\n```text\n<promise>COMPLETE</promise>\n```", "COMPLETE"),
    ).toBeTrue();
  });

  it("拒绝代码块结束后仍有额外非空内容的 promise", () => {
    expect(
      checkTerminalPromise("```text\n<promise>COMPLETE</promise>\n```\nextra", "COMPLETE"),
    ).toBeFalse();
  });

  it("接受真实收尾总结后附带的最后一个代码块 promise", () => {
    expect(
      checkTerminalPromise(
        "已按要求完成这次 OpenSpec change 的收尾核对。\n\n简短总结：\n- 当前变更已完成\n\n```text\n<promise>COMPLETE</promise>\n```",
        "COMPLETE",
      ),
    ).toBeTrue();
  });

  it("接受 promise 结尾附带零宽字符", () => {
    expect(checkTerminalPromise("<promise>COMPLETE</promise>\u200b", "COMPLETE")).toBeTrue();
  });

  it("接受 promise 结尾附带终端控制序列", () => {
    expect(checkTerminalPromise("<promise>COMPLETE</promise>\u001b[K", "COMPLETE")).toBeTrue();
  });

  it("接受最后代码块闭合后附带终端控制序列", () => {
    expect(checkTerminalPromise("```text\n<promise>COMPLETE</promise>\n```\u001b[K", "COMPLETE")).toBeTrue();
  });
});
