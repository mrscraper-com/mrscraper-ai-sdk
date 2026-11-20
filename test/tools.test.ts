import { MrScraperError } from "@mrscraper/sdk";
import { asSchema, type Tool } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  getScreenshotTool,
  scrapeBrandTool,
  scrapeHtmlTool,
  scrapeJsonTool,
  scrapeMarkdownTool,
  statusTool,
  webSearchTool,
} from "../src/index.js";

const KEY = "atk_testtesttesttest";
// Standard placeholder values.
const PAGE_URL = "https://www.scrapethissite.com";
const BRAND_URL = "https://mrscraper.com";
const JSON_URL = "https://mrscraper.com/pricing";
const SCRAPER_API = "https://api.mrscraper.com/";

const pageDefaults = {
  timeout: "300",
  geoCode: "us",
  proxyCountry: "us",
  super: "false",
  waitUntil: "domcontentloaded",
  saveResult: "false",
};
const loadingDefaults = { blockResources: "false", returnCookie: "false" };

beforeEach(() => {
  for (const name of ["MRSCRAPER_API_KEY", "MRSCRAPER_API_TOKEN", "MRSCRAPER_API_BASE_URL", "MRSCRAPER_FETCH_BASE_URL"]) {
    vi.stubEnv(name, "");
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

type FetchMock = Mock<(url: string, init: RequestInit) => Promise<Response>>;

function stubFetch(response: () => Response): FetchMock {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: FetchMock) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  const parsed = new URL(url);
  return {
    method: init.method,
    endpoint: `${parsed.origin}${parsed.pathname}`,
    query: Object.fromEntries(parsed.searchParams),
    headers: new Headers(init.headers),
    body: init.body,
  };
}

/** Validates raw model input with the tool's input schema, as the AI SDK does before execute. */
async function parse<INPUT>(tool: Tool<INPUT>, input: unknown): Promise<INPUT> {
  const result = await asSchema(tool.inputSchema).validate!(input);
  if (!result.success) throw result.error;
  return result.value;
}

async function accepts(tool: Tool, input: unknown): Promise<boolean> {
  return (await asSchema(tool.inputSchema).validate!(input)).success;
}

async function run<INPUT, OUTPUT>(tool: Tool<INPUT, OUTPUT>, input: unknown): Promise<OUTPUT> {
  const output = await tool.execute!(await parse(tool, input), { toolCallId: "call-1", messages: [], context: {} });
  return output as OUTPUT;
}

describe("statusTool", () => {
  it("gets the raw account status and drops credential headers", async () => {
    const body = { message: "Example response", data: { id: "ACCOUNT_ID", tokenLimit: 100000, tokenUsage: 2500 } };
    const fetchMock = stubFetch(() => Response.json(body, { headers: { "x-api-token": KEY } }));
    const result = await run(statusTool({ apiKey: KEY }), {});
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.endpoint).toBe("https://api.app.mrscraper.com/api/v1/subscription-accounts");
    expect(request.body).toBeUndefined();
    expect(request.headers.get("x-api-token")).toBe(KEY);
    expect(request.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(result).toEqual({ status_code: 200, data: body, headers: { "content-type": "application/json" } });
  });

  it("takes no inputs", async () => {
    expect(await accepts(statusTool(), { timeout: 30 })).toBe(false);
  });
});

describe("scrapeHtmlTool", () => {
  it("sends a GET with the standard defaults and html forced on", async () => {
    const html = "<html><body>Example page content...</body></html>";
    const fetchMock = stubFetch(
      () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
    const result = await run(scrapeHtmlTool({ apiKey: KEY }), { url: PAGE_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.endpoint).toBe(SCRAPER_API);
    expect(request.query).toEqual({
      url: PAGE_URL,
      ...pageDefaults,
      ...loadingDefaults,
      browserRendering: "false",
      warmStart: "false",
      html: "true",
      markdown: "false",
      screenshot: "false",
    });
    expect(result).toEqual({ status_code: 200, data: html, headers: { "content-type": "text/html; charset=utf-8" } });
  });

  it("passes optional controls and lowercases country codes", async () => {
    const fetchMock = stubFetch(() => new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    await run(scrapeHtmlTool({ apiKey: KEY }), {
      url: PAGE_URL,
      browserRendering: true,
      warmStart: true,
      waitForSelector: "body",
      timeout: 120,
      maxRetries: 0,
      geoCode: "GB",
      proxyCountry: "DE",
      proxy: "http://proxy.example:8080",
    });
    expect(sent(fetchMock).query).toMatchObject({
      browserRendering: "true",
      warmStart: "true",
      waitForSelector: "body",
      timeout: "120",
      maxRetries: "0",
      geoCode: "gb",
      proxyCountry: "de",
      proxy: "http://proxy.example:8080",
    });
  });

  it("rejects disabled and invalid inputs before any request", async () => {
    const fetchMock = stubFetch(() => new Response(""));
    const tool = scrapeHtmlTool({ apiKey: KEY });
    expect(await accepts(tool, { url: PAGE_URL, tokenCap: 100 })).toBe(false);
    expect(await accepts(tool, { url: PAGE_URL, record: true })).toBe(false);
    expect(await accepts(tool, { url: "ftp://example.com" })).toBe(false);
    expect(await accepts(tool, { url: PAGE_URL, timeout: 301 })).toBe(false);
    expect(await accepts(tool, { url: PAGE_URL, geoCode: "usa" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("scrapeMarkdownTool", () => {
  it("forces markdown on and leaves html and browser rendering off by default", async () => {
    const fetchMock = stubFetch(
      () => new Response("# Example page", { headers: { "content-type": "text/markdown; charset=utf-8" } }),
    );
    const result = await run(scrapeMarkdownTool({ apiKey: KEY }), { url: PAGE_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.query).toEqual({
      url: PAGE_URL,
      ...pageDefaults,
      ...loadingDefaults,
      browserRendering: "false",
      warmStart: "false",
      html: "false",
      markdown: "true",
      screenshot: "false",
    });
    expect(result.data).toBe("# Example page");
  });

  it("enables browser rendering when html is included", async () => {
    const data = { html: "<html>...</html>", markdown: "# Example page" };
    const fetchMock = stubFetch(() => Response.json(data));
    const result = await run(scrapeMarkdownTool({ apiKey: KEY }), { url: PAGE_URL, html: true });
    expect(sent(fetchMock).query).toMatchObject({ html: "true", markdown: "true", browserRendering: "true" });
    expect(result.data).toEqual(data);
  });
});

describe("getScreenshotTool", () => {
  it("always renders and captures the full page with html by default", async () => {
    const fetchMock = stubFetch(() => Response.json({ html: "<html></html>", screenshot: "iVBORw0KGgo=" }));
    await run(getScreenshotTool({ apiKey: KEY }), { url: PAGE_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.query).toEqual({
      url: PAGE_URL,
      ...pageDefaults,
      ...loadingDefaults,
      browserRendering: "true",
      screenshot: "full",
      html: "true",
      markdown: "false",
    });
  });

  it("passes the screenshot area and page outputs", async () => {
    const fetchMock = stubFetch(() => Response.json({ screenshot: "iVBORw0KGgo=", markdown: "# Example page" }));
    await run(getScreenshotTool({ apiKey: KEY }), { url: PAGE_URL, screenshot: "top", html: false, markdown: true });
    expect(sent(fetchMock).query).toMatchObject({ screenshot: "top", html: "false", markdown: "true" });
  });

  it("does not accept browserRendering, which is always on", async () => {
    expect(await accepts(getScreenshotTool(), { url: PAGE_URL, browserRendering: false })).toBe(false);
    expect(await accepts(getScreenshotTool(), { url: PAGE_URL, screenshot: "viewport" })).toBe(false);
  });

  it("sends the screenshot to the model as an image part and keeps it in the result", async () => {
    stubFetch(() => Response.json({ html: "<html></html>", screenshot: "iVBORw0KGgo=" }));
    const tool = getScreenshotTool({ apiKey: KEY });
    const input = await parse(tool, { url: PAGE_URL });
    const output = await run(tool, { url: PAGE_URL });
    expect(output.data).toEqual({ html: "<html></html>", screenshot: "iVBORw0KGgo=" });
    const modelOutput = await tool.toModelOutput!({ toolCallId: "call-1", input, output });
    expect(modelOutput.type).toBe("content");
    const [text, image] = modelOutput.type === "content" ? modelOutput.value : [];
    expect(image).toEqual({ type: "file", mediaType: "image", data: { type: "data", data: "iVBORw0KGgo=" } });
    expect(text?.type === "text" && JSON.parse(text.text)).toEqual({
      status_code: 200,
      data: { html: "<html></html>" },
      headers: { "content-type": "application/json" },
    });
  });

  it("sends a result without a screenshot as JSON", async () => {
    stubFetch(() => Response.json({ html: "<html></html>" }));
    const tool = getScreenshotTool({ apiKey: KEY });
    const input = await parse(tool, { url: PAGE_URL });
    const output = await run(tool, { url: PAGE_URL });
    expect(await tool.toModelOutput!({ toolCallId: "call-1", input, output })).toEqual({ type: "json", value: output });
  });
});

describe("scrapeBrandTool", () => {
  it("sends only the url with the brand-scraping action and no bundle", async () => {
    const body = { data: { job_id: "JOB_ID", status: "succeeded", brand: { name: "Example brand" } }, message: "ok" };
    const fetchMock = stubFetch(() => Response.json(body));
    const result = await run(scrapeBrandTool({ apiKey: KEY }), { url: BRAND_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.endpoint).toBe(SCRAPER_API);
    expect(request.query).toEqual({ action: "brand-scraping", url: BRAND_URL, bundle: "none" });
    expect(result.data).toEqual(body);
  });

  it("does not accept page controls", async () => {
    expect(await accepts(scrapeBrandTool(), { url: BRAND_URL, timeout: 60 })).toBe(false);
    expect(await accepts(scrapeBrandTool(), { url: BRAND_URL, bundle: "full" })).toBe(false);
  });
});

describe("scrapeJsonTool", () => {
  it("uses the general agent and the default prompt", async () => {
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [], screenshot: "" }));
    await run(scrapeJsonTool({ apiKey: KEY }), { url: JSON_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.query).toEqual({
      url: JSON_URL,
      ...pageDefaults,
      browserRendering: "false",
      html: "false",
      screenshot: "false",
      agent: "general",
      prompt: "Extract all data as complete as possible.",
    });
  });

  it("passes the prompt and switches to POST above an 8,000-character URL", async () => {
    const prompt = `Extract all data as complete as possible ${"x".repeat(9000)}`;
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [] }));
    await run(scrapeJsonTool({ apiKey: KEY }), { url: JSON_URL, prompt, browserRendering: true });
    const request = sent(fetchMock);
    expect(request.method).toBe("POST");
    expect(request.query).not.toHaveProperty("url");
    expect(request.query).not.toHaveProperty("prompt");
    expect(request.query).toMatchObject({ browserRendering: "true" });
    expect(JSON.parse(String(request.body))).toEqual({ url: JSON_URL, prompt, agent: "general" });
  });

  it("does not accept loading controls", async () => {
    for (const control of [{ waitForSelector: "body" }, { blockResources: true }, { returnCookie: true }]) {
      expect(await accepts(scrapeJsonTool(), { url: JSON_URL, ...control })).toBe(false);
    }
    expect(await accepts(scrapeJsonTool(), { url: JSON_URL, prompt: "   " })).toBe(false);
  });

  it("sends a requested screenshot to the model as an image part", async () => {
    stubFetch(() => Response.json({ success: true, data: [{ title: "Plan" }], screenshot: "iVBORw0KGgo=" }));
    const tool = scrapeJsonTool({ apiKey: KEY });
    const input = await parse(tool, { url: JSON_URL, screenshot: true });
    const output = await run(tool, { url: JSON_URL, screenshot: true });
    const modelOutput = await tool.toModelOutput!({ toolCallId: "call-1", input, output });
    expect(modelOutput.type === "content" && modelOutput.value[1]).toEqual({
      type: "file",
      mediaType: "image",
      data: { type: "data", data: "iVBORw0KGgo=" },
    });
  });
});

describe("webSearchTool", () => {
  it("sends a GET with the websearch action, a trimmed query, and the default country and count", async () => {
    const body = {
      success: true,
      message: "Example response",
      data: [{ rank: 1, title: "MrScraper", url: "https://mrscraper.com", description: "", source: "mrscraper.com" }],
      tokenUsage: 1,
    };
    const fetchMock = stubFetch(() => Response.json(body));
    const result = await run(webSearchTool({ apiKey: KEY }), { query: "  mrscraper  " });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.endpoint).toBe(SCRAPER_API);
    expect(request.query).toEqual({ action: "websearch", query: "mrscraper", country: "us", numResults: "10" });
    expect(result).toEqual({ status_code: 200, data: body, headers: { "content-type": "application/json" } });
  });

  it("lowercases the country and passes the result count", async () => {
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [] }));
    await run(webSearchTool({ apiKey: KEY }), { query: "mrscraper", country: "ID", numResults: 20 });
    expect(sent(fetchMock).query).toMatchObject({ country: "id", numResults: "20" });
  });

  it("rejects removed and out-of-range inputs", async () => {
    const tool = webSearchTool();
    expect(await accepts(tool, { query: "mrscraper", region: "us" })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", num_results: 10 })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", numResults: 5 })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", numResults: 101 })).toBe(false);
    expect(await accepts(tool, { query: "   " })).toBe(false);
    expect(await accepts(tool, { query: "x".repeat(1001) })).toBe(false);
    expect(await accepts(tool, { query: "x".repeat(1000) })).toBe(true);
  });
});

describe("authentication and errors", () => {
  it("reads MRSCRAPER_API_KEY, then MRSCRAPER_API_TOKEN", async () => {
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [] }));
    vi.stubEnv("MRSCRAPER_API_TOKEN", "atk_fromtokenvariable");
    await run(webSearchTool(), { query: "mrscraper" });
    vi.stubEnv("MRSCRAPER_API_KEY", "atk_fromkeyvariable");
    await run(webSearchTool(), { query: "mrscraper" });
    const keys = fetchMock.mock.calls.map(([, init]) => new Headers(init.headers).get("x-api-token"));
    expect(keys).toEqual(["atk_fromtokenvariable", "atk_fromkeyvariable"]);
  });

  it("throws MrScraperError without a request when no key is set", async () => {
    const fetchMock = stubFetch(() => Response.json({}));
    const error = await run(scrapeHtmlTool(), { url: PAGE_URL }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MrScraperError);
    expect((error as MrScraperError).message).toContain("Pass apiKey or set MRSCRAPER_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws MrScraperError with the status and without the key for API errors", async () => {
    stubFetch(() => Response.json({ success: false, message: `Invalid request (${KEY})` }, { status: 400 }));
    const error = await run(webSearchTool({ apiKey: KEY }), { query: "mrscraper" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MrScraperError);
    expect((error as MrScraperError).status).toBe(400);
    expect((error as MrScraperError).message).toContain("Invalid request");
    expect((error as MrScraperError).message).not.toContain(KEY);
  });

  it("reports an invalid key as a 401 MrScraperError", async () => {
    stubFetch(() => Response.json({ message: "Unauthorized access" }, { status: 401 }));
    await expect(run(statusTool({ apiKey: "atk_wrongwrongwrong" }), {})).rejects.toMatchObject({ status: 401 });
  });
});
