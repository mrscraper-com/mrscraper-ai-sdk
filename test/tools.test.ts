import { asSchema, type Tool } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  MrScraperError,
  getScreenshotTool,
  scrapeBrandTool,
  scrapeHtmlTool,
  scrapeJsonTool,
  scrapeMarkdownTool,
  statusTool,
  webSearchTool,
} from "../src/index.js";

const KEY = "atk_testtesttesttest";
// Placeholder values from MrScraper's integration examples.
const PAGE_URL = "https://www.scrapethissite.com";
const BRAND_URL = "https://mrscraper.com";
const JSON_URL = "https://mrscraper.com/pricing";
const SCRAPER_API = "https://api.mrscraper.com/";
const STATUS_API = "https://api.app.mrscraper.com/api/v1/subscription-accounts";

/** Inputs of earlier versions that no tool accepts any more. */
const REMOVED_INPUTS: Record<string, unknown> = {
  super: true,
  proxy: "http://proxy.example:8080",
  proxyCountry: "us",
  waitUntil: "load",
  returnCookie: true,
  tokenCap: 100,
  record: true,
  action: "scrape",
  saveResult: false,
};

beforeEach(() => {
  vi.stubEnv("MRSCRAPER_API_KEY", "");
  vi.stubEnv("MRSCRAPER_API_TOKEN", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

type FetchMock = Mock<(url: string, init: RequestInit) => Promise<Response>>;

function stubFetch(response: () => Response): FetchMock {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The single request the tool sent, with the query string as ordered pairs. */
function sent(fetchMock: FetchMock) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  const parsed = new URL(url);
  return {
    method: init.method,
    url,
    endpoint: `${parsed.origin}${parsed.pathname}`,
    query: [...parsed.searchParams],
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

async function rejectsRemovedInputs(tool: Tool, input: Record<string, unknown>): Promise<void> {
  for (const [name, value] of Object.entries(REMOVED_INPUTS)) {
    expect(await accepts(tool, { ...input, [name]: value }), name).toBe(false);
  }
}

describe("statusTool", () => {
  it("gets the raw account status and drops credential headers", async () => {
    const body = { message: "Example response", data: { id: "ACCOUNT_ID", tokenLimit: 100000, tokenUsage: 2500 } };
    const fetchMock = stubFetch(() =>
      Response.json(body, { headers: { "x-api-token": KEY, "x-discard-token-secret": "secret" } }),
    );
    const result = await run(statusTool({ apiKey: KEY }), {});
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(STATUS_API);
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
  it("sends the url, maxAge=0, and the fixed values when the model sets nothing else", async () => {
    const html = "<html><body>Example page content...</body></html>";
    const fetchMock = stubFetch(
      () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
    const result = await run(scrapeHtmlTool({ apiKey: KEY }), { url: PAGE_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      `${SCRAPER_API}?url=https%3A%2F%2Fwww.scrapethissite.com&maxAge=0&html=true&markdown=false&saveResult=true`,
    );
    expect(request.body).toBeUndefined();
    expect(request.headers.get("x-api-token")).toBe(KEY);
    expect(request.headers.get("content-type")).toBeNull();
    expect(result).toEqual({ status_code: 200, data: html, headers: { "content-type": "text/html; charset=utf-8" } });
  });

  it("sends every input the model sets, in order, with the country code in lowercase", async () => {
    const fetchMock = stubFetch(() => Response.json({ html: "<html></html>", screenshot: "iVBORw0KGgo=" }));
    await run(scrapeHtmlTool({ apiKey: KEY }), {
      url: PAGE_URL,
      browserRendering: false,
      timeout: 330,
      warmStart: true,
      blockResources: true,
      waitForSelector: "#results",
      geoCode: "GB",
      maxAge: 86400000,
      maxRetries: 0,
      screenshot: "1920x1080-75",
    });
    expect(sent(fetchMock).query).toEqual([
      ["url", PAGE_URL],
      ["browserRendering", "false"],
      ["timeout", "330"],
      ["warmStart", "true"],
      ["blockResources", "true"],
      ["waitForSelector", "#results"],
      ["geoCode", "gb"],
      ["maxAge", "86400000"],
      ["maxRetries", "0"],
      ["screenshot", "1920x1080-75"],
      ["html", "true"],
      ["markdown", "false"],
      ["saveResult", "true"],
    ]);
  });

  it("accepts the screenshot forms and range limits", async () => {
    const tool = scrapeHtmlTool();
    for (const screenshot of ["full", "top", "1280x800", "100x100-25", "3840x3840-300"]) {
      expect(await accepts(tool, { url: PAGE_URL, screenshot }), screenshot).toBe(true);
    }
    for (const screenshot of ["", "viewport", "FULL", "99x800", "1280x3841", "12800x800", "1280x800-24", "1280x800-301"]) {
      expect(await accepts(tool, { url: PAGE_URL, screenshot }), screenshot).toBe(false);
    }
    expect(await accepts(tool, { url: PAGE_URL, timeout: 1, maxAge: 604800000, waitForSelector: "x".repeat(500) })).toBe(
      true,
    );
  });

  it("rejects removed and invalid inputs before any request", async () => {
    const fetchMock = stubFetch(() => new Response(""));
    const tool = scrapeHtmlTool({ apiKey: KEY });
    await rejectsRemovedInputs(tool, { url: PAGE_URL });
    for (const input of [
      { url: "ftp://example.com" },
      { url: "www.scrapethissite.com" },
      { url: PAGE_URL, html: false },
      { url: PAGE_URL, markdown: true },
      { url: PAGE_URL, timeout: 0 },
      { url: PAGE_URL, timeout: 331 },
      { url: PAGE_URL, geoCode: "usa" },
      { url: PAGE_URL, maxAge: -1 },
      { url: PAGE_URL, maxAge: 604800001 },
      { url: PAGE_URL, maxRetries: -1 },
      { url: PAGE_URL, waitForSelector: "  " },
      { url: PAGE_URL, waitForSelector: "x".repeat(501) },
    ]) {
      expect(await accepts(tool, input), JSON.stringify(input)).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a requested screenshot to the model as an image part", async () => {
    stubFetch(() => Response.json({ html: "<html></html>", screenshot: "iVBORw0KGgo=" }));
    const tool = scrapeHtmlTool({ apiKey: KEY });
    const input = await parse(tool, { url: PAGE_URL, screenshot: "top" });
    const output = await run(tool, { url: PAGE_URL, screenshot: "top" });
    const modelOutput = await tool.toModelOutput!({ toolCallId: "call-1", input, output });
    expect(modelOutput.type === "content" && modelOutput.value).toEqual([
      {
        type: "text",
        text: JSON.stringify({
          status_code: 200,
          data: { html: "<html></html>" },
          headers: { "content-type": "application/json" },
        }),
      },
      { type: "file", mediaType: "image", data: { type: "data", data: "iVBORw0KGgo=" } },
    ]);
  });
});

describe("scrapeMarkdownTool", () => {
  it("sends the url, maxAge=0, and the fixed values when the model sets nothing else", async () => {
    const fetchMock = stubFetch(
      () => new Response("# Example page", { headers: { "content-type": "text/markdown; charset=utf-8" } }),
    );
    const result = await run(scrapeMarkdownTool({ apiKey: KEY }), { url: PAGE_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      `${SCRAPER_API}?url=https%3A%2F%2Fwww.scrapethissite.com&maxAge=0&markdown=true&html=false&screenshot=false&saveResult=true`,
    );
    expect(result.data).toBe("# Example page");
  });

  it("sends every input the model sets, in order", async () => {
    const fetchMock = stubFetch(() => new Response("# Example page", { headers: { "content-type": "text/markdown" } }));
    await run(scrapeMarkdownTool({ apiKey: KEY }), {
      url: PAGE_URL,
      browserRendering: true,
      timeout: 120,
      geoCode: "ID",
      warmStart: false,
      blockResources: false,
      waitForSelector: "main",
      maxAge: 3600000,
      maxRetries: 2,
    });
    expect(sent(fetchMock).query).toEqual([
      ["url", PAGE_URL],
      ["browserRendering", "true"],
      ["timeout", "120"],
      ["geoCode", "id"],
      ["warmStart", "false"],
      ["blockResources", "false"],
      ["waitForSelector", "main"],
      ["maxAge", "3600000"],
      ["maxRetries", "2"],
      ["markdown", "true"],
      ["html", "false"],
      ["screenshot", "false"],
      ["saveResult", "true"],
    ]);
  });

  it("rejects removed inputs and the fixed output fields", async () => {
    const tool = scrapeMarkdownTool();
    await rejectsRemovedInputs(tool, { url: PAGE_URL });
    for (const field of [{ html: true }, { markdown: false }, { screenshot: "full" }]) {
      expect(await accepts(tool, { url: PAGE_URL, ...field }), JSON.stringify(field)).toBe(false);
    }
  });
});

describe("getScreenshotTool", () => {
  it("captures the full page with browser rendering by default", async () => {
    const fetchMock = stubFetch(() => Response.json({ screenshot: "iVBORw0KGgo=" }));
    await run(getScreenshotTool({ apiKey: KEY }), { url: PAGE_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      `${SCRAPER_API}?url=https%3A%2F%2Fwww.scrapethissite.com&screenshot=full&maxAge=0&browserRendering=true&html=false&markdown=false&saveResult=true`,
    );
  });

  it("sends every input the model sets, in order", async () => {
    const fetchMock = stubFetch(() => Response.json({ screenshot: "iVBORw0KGgo=" }));
    await run(getScreenshotTool({ apiKey: KEY }), {
      url: PAGE_URL,
      screenshot: "1280x800",
      timeout: 60,
      geoCode: "us",
      waitForSelector: ".chart",
      maxAge: 0,
      maxRetries: 1,
    });
    expect(sent(fetchMock).query).toEqual([
      ["url", PAGE_URL],
      ["screenshot", "1280x800"],
      ["timeout", "60"],
      ["geoCode", "us"],
      ["waitForSelector", ".chart"],
      ["maxAge", "0"],
      ["maxRetries", "1"],
      ["browserRendering", "true"],
      ["html", "false"],
      ["markdown", "false"],
      ["saveResult", "true"],
    ]);
  });

  it("rejects removed inputs and inputs the screenshot service does not take", async () => {
    const tool = getScreenshotTool();
    await rejectsRemovedInputs(tool, { url: PAGE_URL });
    for (const field of [
      { browserRendering: false },
      { html: true },
      { markdown: true },
      { blockResources: true },
      { warmStart: true },
      { screenshot: "viewport" },
    ]) {
      expect(await accepts(tool, { url: PAGE_URL, ...field }), JSON.stringify(field)).toBe(false);
    }
  });

  it("sends the screenshot to the model as an image part and keeps it in the result", async () => {
    stubFetch(() => Response.json({ screenshot: "iVBORw0KGgo=" }));
    const tool = getScreenshotTool({ apiKey: KEY });
    const input = await parse(tool, { url: PAGE_URL });
    const output = await run(tool, { url: PAGE_URL });
    expect(output.data).toEqual({ screenshot: "iVBORw0KGgo=" });
    const modelOutput = await tool.toModelOutput!({ toolCallId: "call-1", input, output });
    expect(modelOutput.type === "content" && modelOutput.value).toEqual([
      {
        type: "text",
        text: JSON.stringify({ status_code: 200, data: {}, headers: { "content-type": "application/json" } }),
      },
      { type: "file", mediaType: "image", data: { type: "data", data: "iVBORw0KGgo=" } },
    ]);
  });

  it("sends a result without a screenshot as JSON", async () => {
    stubFetch(() => Response.json({ message: "No screenshot" }));
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
    expect(request.url).toBe(`${SCRAPER_API}?action=brand-scraping&url=https%3A%2F%2Fmrscraper.com&bundle=none`);
    expect(result.data).toEqual(body);
  });

  it("takes only the url", async () => {
    const tool = scrapeBrandTool();
    for (const field of [{ timeout: 60 }, { geoCode: "us" }, { warmStart: true }, { maxAge: 0 }, { bundle: "full" }]) {
      expect(await accepts(tool, { url: BRAND_URL, ...field }), JSON.stringify(field)).toBe(false);
    }
  });
});

describe("scrapeJsonTool", () => {
  it("sends the url, the output defaults, maxAge=0, and the fixed values when the model sets nothing else", async () => {
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [], html: "<html></html>" }));
    await run(scrapeJsonTool({ apiKey: KEY }), { url: JSON_URL });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.url).toBe(
      `${SCRAPER_API}?url=https%3A%2F%2Fmrscraper.com%2Fpricing&html=true&screenshot=false&maxAge=0&saveResult=true&agent=general`,
    );
  });

  it("sends every input the model sets, in order", async () => {
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [] }));
    await run(scrapeJsonTool({ apiKey: KEY }), {
      url: JSON_URL,
      prompt: "Extract each plan with name and price.",
      html: false,
      screenshot: true,
      browserRendering: true,
      waitForSelector: "#pricing",
      warmStart: true,
      blockResources: true,
      timeout: 200,
      geoCode: "SG",
      maxAge: 1000,
      maxRetries: 3,
    });
    expect(sent(fetchMock).query).toEqual([
      ["url", JSON_URL],
      ["prompt", "Extract each plan with name and price."],
      ["html", "false"],
      ["screenshot", "true"],
      ["browserRendering", "true"],
      ["waitForSelector", "#pricing"],
      ["warmStart", "true"],
      ["blockResources", "true"],
      ["timeout", "200"],
      ["geoCode", "sg"],
      ["maxAge", "1000"],
      ["maxRetries", "3"],
      ["saveResult", "true"],
      ["agent", "general"],
    ]);
  });

  it("switches to POST when the GET URL would exceed 8,000 characters", async () => {
    const fixed = `${SCRAPER_API}?url=https%3A%2F%2Fmrscraper.com%2Fpricing&prompt=&html=true&screenshot=false&maxAge=0&saveResult=true&agent=general`;
    const longest = "x".repeat(8000 - fixed.length);
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [] }));
    const tool = scrapeJsonTool({ apiKey: KEY });
    await run(tool, { url: JSON_URL, prompt: longest });
    await run(tool, { url: JSON_URL, prompt: `${longest}x` });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getUrl, getInit] = fetchMock.mock.calls[0]!;
    const [postUrl, postInit] = fetchMock.mock.calls[1]!;
    expect(getInit.method).toBe("GET");
    expect(getUrl.length).toBe(8000);
    expect(postInit.method).toBe("POST");
    expect(postUrl).toBe(`${SCRAPER_API}?html=true&screenshot=false&maxAge=0&saveResult=true`);
    expect(JSON.parse(String(postInit.body))).toEqual({ url: JSON_URL, prompt: `${longest}x`, agent: "general" });
    expect(new Headers(postInit.headers).get("content-type")).toBe("application/json");
  });

  it("rejects removed inputs, fixed values, and a blank prompt", async () => {
    const tool = scrapeJsonTool();
    await rejectsRemovedInputs(tool, { url: JSON_URL });
    for (const field of [{ agent: "general" }, { markdown: true }, { prompt: "" }, { prompt: "   " }, { screenshot: "full" }]) {
      expect(await accepts(tool, { url: JSON_URL, ...field }), JSON.stringify(field)).toBe(false);
    }
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
  it("sends the websearch action and the trimmed query when the model sets nothing else", async () => {
    const body = {
      success: true,
      message: "Example response",
      data: [{ rank: 1, title: "MrScraper", url: "https://mrscraper.com", description: "", source: "mrscraper.com" }],
      tokenUsage: 1,
    };
    const fetchMock = stubFetch(() => Response.json(body));
    const result = await run(webSearchTool({ apiKey: KEY }), { query: "  mrscraper pricing  " });
    const request = sent(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.url).toBe(`${SCRAPER_API}?action=websearch&query=mrscraper+pricing`);
    expect(result).toEqual({ status_code: 200, data: body, headers: { "content-type": "application/json" } });
  });

  it("sends the country in lowercase and the result count", async () => {
    const fetchMock = stubFetch(() => Response.json({ success: true, data: [] }));
    await run(webSearchTool({ apiKey: KEY }), { query: "mrscraper", country: "ID", numResults: 20 });
    expect(sent(fetchMock).query).toEqual([
      ["action", "websearch"],
      ["query", "mrscraper"],
      ["country", "id"],
      ["numResults", "20"],
    ]);
  });

  it("rejects earlier and out-of-range inputs", async () => {
    const tool = webSearchTool();
    expect(await accepts(tool, { query: "mrscraper", region: "us" })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", num_results: 10 })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", numResults: 9 })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", numResults: 101 })).toBe(false);
    expect(await accepts(tool, { query: "mrscraper", country: "usa" })).toBe(false);
    expect(await accepts(tool, { query: "   " })).toBe(false);
    expect(await accepts(tool, { query: "x".repeat(1001) })).toBe(false);
    expect(await accepts(tool, { query: "x".repeat(1000), numResults: 10 })).toBe(true);
    expect(await accepts(tool, { query: "mrscraper", numResults: 100 })).toBe(true);
  });
});

describe("HTTP deadlines", () => {
  it.each([
    { name: "status", tool: statusTool({ apiKey: KEY }), input: {}, seconds: 600 },
    { name: "scrapeHtml without a timeout", tool: scrapeHtmlTool({ apiKey: KEY }), input: { url: PAGE_URL }, seconds: 330 },
    {
      name: "scrapeMarkdown with timeout 60",
      tool: scrapeMarkdownTool({ apiKey: KEY }),
      input: { url: PAGE_URL, timeout: 60 },
      seconds: 90,
    },
    {
      name: "getScreenshot with timeout 330",
      tool: getScreenshotTool({ apiKey: KEY }),
      input: { url: PAGE_URL, timeout: 330 },
      seconds: 360,
    },
    { name: "scrapeJson with timeout 1", tool: scrapeJsonTool({ apiKey: KEY }), input: { url: JSON_URL, timeout: 1 }, seconds: 31 },
    { name: "scrapeBrand", tool: scrapeBrandTool({ apiKey: KEY }), input: { url: BRAND_URL }, seconds: 120 },
    { name: "webSearch", tool: webSearchTool({ apiKey: KEY }), input: { query: "mrscraper" }, seconds: 120 },
  ])("$name gives up after $seconds seconds", async ({ tool, input, seconds }) => {
    vi.useFakeTimers();
    const fetchMock: FetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const outcome = run(tool as Tool, input).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(seconds * 1000 - 1);
    expect(fetchMock.mock.calls[0]![1].signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await outcome;
    expect(error).toBeInstanceOf(MrScraperError);
    expect((error as MrScraperError).message).toBe(`Request timed out after ${seconds} seconds`);
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
    expect((error as MrScraperError).message).toBe('{"success":false,"message":"Invalid request ([REDACTED])"}');
  });

  it("reports an invalid key as a 401 MrScraperError", async () => {
    stubFetch(() => Response.json({ message: "Unauthorized access" }, { status: 401 }));
    await expect(run(statusTool({ apiKey: "atk_wrongwrongwrong" }), {})).rejects.toMatchObject({
      name: "MrScraperError",
      status: 401,
      message: "Unauthorized or invalid API key. Get your key at https://app.mrscraper.com/api-tokens.",
    });
  });

  it("throws MrScraperError without the key for network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`fetch failed (${KEY})`);
      }),
    );
    const error = await run(scrapeBrandTool({ apiKey: KEY }), { url: BRAND_URL }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MrScraperError);
    expect((error as MrScraperError).message).toBe("fetch failed ([REDACTED])");
    expect((error as MrScraperError).status).toBeUndefined();
  });
});
