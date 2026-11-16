import { afterEach, describe, expect, it, vi } from "vitest";

import { scraperApiTool } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scraperApiTool", () => {
  it("requests the page with a GET and no body, and returns only the requested formats", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ markdown: "# Item", html: "<html><body>Item</body></html>", token_usage: 2 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const scraperApi = scraperApiTool({ apiKey: "atk_testtesttesttest" });
    const result = await scraperApi.execute!(
      { url: "https://shop.test/item", formats: ["markdown"] },
      { toolCallId: "call-1", messages: [], context: {} },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    // The Scraper API passes a request body on to the target page, so the target must see a plain GET.
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    const requested = new URL(url);
    expect(requested.origin).toBe("https://api.mrscraper.com");
    expect(requested.searchParams.get("url")).toBe("https://shop.test/item");
    expect(requested.searchParams.get("markdown")).toBe("true");
    expect(requested.searchParams.get("html")).toBe("false");
    expect(result).toEqual({ url: "https://shop.test/item", statusCode: 200, markdown: "# Item", tokenUsage: 2 });
  });
});
