import { describe, expect, it } from "vitest";

import { toPageModelOutput, toPageResult, toSearchResult } from "../src/results.js";

describe("toPageResult", () => {
  it("returns only the requested formats the API produced", () => {
    const result = toPageResult("https://shop.test/item", ["markdown", "screenshot"], {
      status_code: 200,
      data: {
        markdown: "# Item",
        html: "<h1>Item</h1>",
        screenshot: "",
        token_usage: 2,
        error: null,
      },
    });
    expect(result).toEqual({
      url: "https://shop.test/item",
      statusCode: 200,
      markdown: "# Item",
      tokenUsage: 2,
    });
  });

  it("surfaces an error the API reported with a 2xx status", () => {
    const result = toPageResult("https://shop.test/item", ["html"], {
      status_code: 200,
      data: { error: { message: "Target timed out" } },
    });
    expect(result.error).toBe('{"message":"Target timed out"}');
    expect(result.html).toBeUndefined();
  });

  it("treats the raw HTML string an HTML-only request returns as the html format", () => {
    const result = toPageResult("https://shop.test/item", ["html"], {
      status_code: 200,
      data: "<!doctype html><title>Item</title>",
    });
    expect(result).toEqual({
      url: "https://shop.test/item",
      statusCode: 200,
      html: "<!doctype html><title>Item</title>",
    });
  });
});

describe("toSearchResult", () => {
  it("keeps result order and drops icons and display links", () => {
    const result = toSearchResult("timeouts", {
      status_code: 200,
      data: {
        data: {
          general: { query: "python requests timeout" },
          organic: [
            { rank: 1, title: "A", link: "https://a.test", description: "first", source: "A", icon: "data:image/png;base64,AAAA", display_link: "a.test" },
            { rank: 2, title: "B", link: "https://b.test" },
          ],
          people_also_ask: [],
          pagination: { next_page: 2 },
        },
      },
    });
    expect(result).toEqual({
      query: "python requests timeout",
      results: [
        { rank: 1, title: "A", link: "https://a.test", description: "first", source: "A" },
        { rank: 2, title: "B", link: "https://b.test", description: undefined, source: undefined },
      ],
      nextPage: 2,
    });
  });

  it("falls back to the input query and reports no next page when the response has neither", () => {
    const result = toSearchResult("no results here", { status_code: 200, data: { data: {} } });
    expect(result).toEqual({ query: "no results here", results: [], nextPage: null });
  });
});

describe("toPageModelOutput", () => {
  it("sends a screenshot as an image part and keeps base64 out of the text", () => {
    const output = toPageModelOutput({
      url: "https://shop.test/item",
      statusCode: 200,
      markdown: "# Item",
      screenshot: "iVBORw0KGgo=",
    });
    expect(output).toEqual({
      type: "content",
      value: [
        { type: "text", text: '{"url":"https://shop.test/item","statusCode":200,"markdown":"# Item"}' },
        { type: "file", mediaType: "image", data: { type: "data", data: "iVBORw0KGgo=" } },
      ],
    });
  });

  it("sends results without a screenshot as JSON", () => {
    expect(toPageModelOutput({ url: "https://shop.test/item", statusCode: 200, html: "<p>x</p>" })).toEqual({
      type: "json",
      value: { url: "https://shop.test/item", statusCode: 200, html: "<p>x</p>" },
    });
  });
});
