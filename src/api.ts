import type {
  GetScreenshotInput,
  ScrapeBrandInput,
  ScrapeHtmlInput,
  ScrapeJsonInput,
  ScrapeMarkdownInput,
  WebSearchInput,
} from "./inputs.js";

/** An API, authentication, network, or timeout failure. Messages never contain the API key. */
export class MrScraperError extends Error {
  /** HTTP status of the failed response, when there was one. */
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "MrScraperError";
    this.status = status;
  }
}

/** Tool result: the HTTP status, the API response body, and the response headers without credential headers. */
export interface MrScraperResponse<T = unknown> {
  status_code: number;
  data: T;
  headers: Record<string, string>;
}

/** HTML or Markdown text, or JSON with html, markdown, and screenshot fields. */
export type PageData =
  | string
  | {
      html?: string;
      markdown?: string;
      screenshot?: string;
      [key: string]: unknown;
    };

export interface WebSearchResult {
  rank: number;
  title: string;
  url: string;
  description: string;
  source: string;
}

export interface WebSearchResponse {
  success: boolean;
  message: string;
  data: WebSearchResult[];
}

const SCRAPER_API_URL = "https://api.mrscraper.com/";
const STATUS_URL = "https://api.app.mrscraper.com/api/v1/subscription-accounts";
/** scrapeJson switches to POST when its GET URL would be longer. */
const MAX_GET_URL_LENGTH = 8000;
/** The page timeout the API applies when the model sets none. */
const DEFAULT_PAGE_TIMEOUT_SECONDS = 300;
/** Response headers that carry credentials; they never reach the tool result. */
const HIDDEN_RESPONSE_HEADERS: Record<string, true> = {
  authorization: true,
  "proxy-authorization": true,
  "set-cookie": true,
  "set-cookie2": true,
  "x-api-token": true,
  "x-discard-token-secret": true,
};

type Query = Record<string, string | number | boolean | undefined>;

/** The Scraper API URL with each set value in the query string. Unset values are left out. */
function endpoint(query: Query): string {
  const url = new URL(SCRAPER_API_URL);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** HTTP deadline of the page services: the page timeout plus 30 seconds. */
function pageDeadline(timeout: number | undefined): number {
  return (timeout ?? DEFAULT_PAGE_TIMEOUT_SECONDS) + 30;
}

async function request<T>(
  method: "GET" | "POST",
  url: string,
  apiKey: string,
  deadlineSeconds: number,
  body?: Record<string, unknown>,
): Promise<MrScraperResponse<T>> {
  const headers: Record<string, string> = {
    accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "x-api-token": apiKey,
  };
  if (body) headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineSeconds * 1000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body && JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (response.status === 401) {
      throw new MrScraperError(
        "Unauthorized or invalid API key. Get your key at https://app.mrscraper.com/api-tokens.",
        401,
      );
    }
    if (!response.ok) {
      throw new MrScraperError(text.replaceAll(apiKey, "[REDACTED]") || `HTTP ${response.status}`, response.status);
    }
    const mediaType = (response.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
    let data: unknown = text;
    if (text && (mediaType === "application/json" || mediaType.endsWith("+json"))) {
      try {
        data = JSON.parse(text);
      } catch {
        // Not JSON after all: the body is returned as text.
      }
    }
    const safeHeaders = Object.fromEntries(
      [...response.headers].filter(([name]) => !Object.hasOwn(HIDDEN_RESPONSE_HEADERS, name)),
    );
    return { status_code: response.status, data: data as T, headers: safeHeaders };
  } catch (error) {
    if (error instanceof MrScraperError) throw error;
    if (controller.signal.aborted) throw new MrScraperError(`Request timed out after ${deadlineSeconds} seconds`);
    const message = error instanceof Error ? error.message : String(error);
    throw new MrScraperError(message.replaceAll(apiKey, "[REDACTED]"));
  } finally {
    clearTimeout(timer);
  }
}

export function status(apiKey: string): Promise<MrScraperResponse> {
  return request("GET", STATUS_URL, apiKey, 600);
}

export function scrapeHtml(input: ScrapeHtmlInput, apiKey: string): Promise<MrScraperResponse<PageData>> {
  const {
    url,
    browserRendering,
    timeout,
    warmStart,
    blockResources,
    waitForSelector,
    geoCode,
    maxAge,
    maxRetries,
    screenshot,
  } = input;
  const query = {
    url,
    browserRendering,
    timeout,
    warmStart,
    blockResources,
    waitForSelector,
    geoCode,
    maxAge,
    maxRetries,
    screenshot,
    html: true,
    markdown: false,
    saveResult: true,
  };
  return request("GET", endpoint(query), apiKey, pageDeadline(timeout));
}

export function scrapeMarkdown(input: ScrapeMarkdownInput, apiKey: string): Promise<MrScraperResponse<PageData>> {
  const { url, browserRendering, timeout, geoCode, warmStart, blockResources, waitForSelector, maxAge, maxRetries } =
    input;
  const query = {
    url,
    browserRendering,
    timeout,
    geoCode,
    warmStart,
    blockResources,
    waitForSelector,
    maxAge,
    maxRetries,
    markdown: true,
    html: false,
    screenshot: false,
    saveResult: true,
  };
  return request("GET", endpoint(query), apiKey, pageDeadline(timeout));
}

export function getScreenshot(input: GetScreenshotInput, apiKey: string): Promise<MrScraperResponse<PageData>> {
  const { url, screenshot, timeout, geoCode, waitForSelector, maxAge, maxRetries } = input;
  const query = {
    url,
    screenshot,
    timeout,
    geoCode,
    waitForSelector,
    maxAge,
    maxRetries,
    browserRendering: true,
    html: false,
    markdown: false,
    saveResult: true,
  };
  return request("GET", endpoint(query), apiKey, pageDeadline(timeout));
}

export function scrapeBrand({ url }: ScrapeBrandInput, apiKey: string): Promise<MrScraperResponse> {
  return request("GET", endpoint({ action: "brand-scraping", url, bundle: "none" }), apiKey, 120);
}

export function scrapeJson(input: ScrapeJsonInput, apiKey: string): Promise<MrScraperResponse> {
  const {
    url,
    prompt,
    html,
    screenshot,
    browserRendering,
    waitForSelector,
    warmStart,
    blockResources,
    timeout,
    geoCode,
    maxAge,
    maxRetries,
  } = input;
  const settings = {
    html,
    screenshot,
    browserRendering,
    waitForSelector,
    warmStart,
    blockResources,
    timeout,
    geoCode,
    maxAge,
    maxRetries,
    saveResult: true,
  };
  const deadline = pageDeadline(timeout);
  const getUrl = endpoint({ url, prompt, ...settings, agent: "general" });
  if (getUrl.length <= MAX_GET_URL_LENGTH) return request("GET", getUrl, apiKey, deadline);
  // Too long for GET: url, prompt, and agent move to a JSON body; the other settings stay in the query.
  return request("POST", endpoint(settings), apiKey, deadline, { url, prompt, agent: "general" });
}

export function webSearch(
  { query, country, numResults }: WebSearchInput,
  apiKey: string,
): Promise<MrScraperResponse<WebSearchResponse>> {
  return request("GET", endpoint({ action: "websearch", query, country, numResults }), apiKey, 120);
}
