import { describe, it, expect, vi } from "vitest";
import { extractResponse } from "../../src/helpers";

describe("extractResponse", () => {
  it("extracts content from a message with a text content field", () => {
    const data = {
      choices: [{
        message: { content: "Here are the search results..." },
      }],
    };
    const result = extractResponse(data);
    expect(result).toEqual({ content: "Here are the search results..." });
  });

  it("extracts tool_calls when no content field is present", () => {
    const data = {
      choices: [{
        message: {
          tool_calls: [
            {
              function: {
                arguments: JSON.stringify({ results: [{ title: "Result 1", url: "https://example.com" }] }),
              },
            },
            {
              function: {
                arguments: JSON.stringify({ results: [{ title: "Result 2", url: "https://example.org" }] }),
              },
            },
          ],
        },
      }],
    };
    const result = extractResponse(data);
    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls).toContain("Result 1");
    expect(result.toolCalls).toContain("Result 2");
    expect(result.toolCalls).toContain("---");
  });

  it("returns empty object when message has no content or tool_calls", () => {
    const data = {
      choices: [{ message: {} }],
    };
    const result = extractResponse(data);
    expect(result).toEqual({});
  });

  it("returns empty when choices array is empty", () => {
    const data = { choices: [] };
    const result = extractResponse(data);
    expect(result).toEqual({});
  });

  it("returns empty when choices is missing entirely", () => {
    const data = {};
    const result = extractResponse(data);
    expect(result).toEqual({});
  });

  it("prefers content over tool_calls when both are present", () => {
    const data = {
      choices: [{
        message: {
          content: "Direct text response",
          tool_calls: [{ function: { arguments: '{"ignored": true}' } }],
        },
      }],
    };
    const result = extractResponse(data);
    expect(result).toEqual({ content: "Direct text response" });
  });

  it("handles empty tool_calls array gracefully", () => {
    const data = {
      choices: [{ message: { tool_calls: [] } }],
    };
    const result = extractResponse(data);
    expect(result).toEqual({});
  });

  it("handles tool_calls with missing function property", () => {
    const data = {
      choices: [{ message: { tool_calls: [{ id: "call_1" }] } }],
    };
    const result = extractResponse(data);
    expect(result).toEqual({});
  });

  it("handles null content in message gracefully", () => {
    const data = {
      choices: [{ message: { content: null } }],
    };
    const result = extractResponse(data);
    expect(result).toEqual({});
  });
});
