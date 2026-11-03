import { MrScraperError } from "@mrscraper/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { searchQuery, webSearch } from "../src/search.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webSearch", () => {
  it("posts the websearch action to the Scraper API host with the key in both headers", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ success: true, data: [], tokenUsage: 1 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await webSearch("atk_testtesttesttest", { query: "running shoes", country: "ID", numResults: 30 });
    expect(response).toEqual({ status_code: 200, data: { success: true, data: [], tokenUsage: 1 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.mrscraper.com");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("x-api-token")).toBe("atk_testtesttesttest");
    expect(headers.get("authorization")).toBe("Bearer atk_testtesttesttest");
    expect(JSON.parse(String(init.body))).toEqual({
      action: "websearch",
      query: "running shoes",
      country: "id",
      numResults: 30,
    });
  });

  it("leaves out the country and result count when they are not given", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ success: true, data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await webSearch("atk_testtesttesttest", { query: "running shoes" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({ action: "websearch", query: "running shoes" });
  });

  it("throws MrScraperError with the status and without the key for API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { success: false, message: "Number must be greater than or equal to 10 (atk_testtesttesttest)", data: null },
          { status: 400 },
        ),
      ),
    );
    const error = await webSearch("atk_testtesttesttest", { query: "q", numResults: 5 }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MrScraperError);
    expect((error as MrScraperError).status).toBe(400);
    expect((error as MrScraperError).message).toContain("greater than or equal to 10");
    expect((error as MrScraperError).message).not.toContain("atk_testtesttesttest");
  });

  it("reports an invalid key as a 401 MrScraperError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Unauthorized access", data: null }, { status: 401 })));
    await expect(webSearch("atk_wrongwrongwrong", { query: "q" })).rejects.toMatchObject({ status: 401 });
  });
});

describe("searchQuery", () => {
  it("uses query text as is and takes q from a search results URL", () => {
    expect(searchQuery("  site:example.com  ")).toBe("site:example.com");
    expect(searchQuery("https://search.example/results?q=running+shoes&page=2")).toBe("running shoes");
    expect(() => searchQuery("https://search.example/results")).toThrow("q parameter");
  });
});
