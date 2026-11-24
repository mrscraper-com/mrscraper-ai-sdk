import { tool, type Tool } from "ai";

import {
  MrScraperError,
  getScreenshot,
  scrapeBrand,
  scrapeHtml,
  scrapeJson,
  scrapeMarkdown,
  status,
  webSearch,
  type MrScraperResponse,
  type PageData,
  type WebSearchResponse,
} from "./api.js";
import {
  getScreenshotInput,
  scrapeBrandInput,
  scrapeHtmlInput,
  scrapeJsonInput,
  scrapeMarkdownInput,
  statusInput,
  webSearchInput,
  type GetScreenshotInput,
  type ScrapeBrandInput,
  type ScrapeHtmlInput,
  type ScrapeJsonInput,
  type ScrapeMarkdownInput,
  type StatusInput,
  type WebSearchInput,
} from "./inputs.js";
import { screenshotModelOutput } from "./model-output.js";

export { MrScraperError } from "./api.js";
export type { MrScraperResponse, PageData, WebSearchResponse, WebSearchResult } from "./api.js";
export type {
  GetScreenshotInput,
  ScrapeBrandInput,
  ScrapeHtmlInput,
  ScrapeJsonInput,
  ScrapeMarkdownInput,
  StatusInput,
  WebSearchInput,
} from "./inputs.js";

export interface MrScraperToolOptions {
  /**
   * API key used to authenticate the request. Defaults to the
   * MRSCRAPER_API_KEY environment variable, then MRSCRAPER_API_TOKEN. Get one
   * at https://app.mrscraper.com/api-tokens.
   */
  apiKey?: string;
}

function apiKey(options: MrScraperToolOptions): string {
  const key = options.apiKey || process.env.MRSCRAPER_API_KEY || process.env.MRSCRAPER_API_TOKEN || "";
  if (!key.trim()) {
    throw new MrScraperError(
      "API key is not set. Pass apiKey or set MRSCRAPER_API_KEY. Get your key at https://app.mrscraper.com/api-tokens.",
    );
  }
  return key;
}

/** Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields. */
export function statusTool(options: MrScraperToolOptions = {}): Tool<StatusInput, MrScraperResponse> {
  return tool({
    description:
      "Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.",
    inputSchema: statusInput,
    execute: async () => status(apiKey(options)),
  });
}

/**
 * Retrieve the raw HTML of a page. Browser rendering and a screenshot are
 * optional. A requested screenshot reaches the model as an image.
 */
export function scrapeHtmlTool(options: MrScraperToolOptions = {}): Tool<ScrapeHtmlInput, MrScraperResponse<PageData>> {
  return tool({
    description: "Retrieve the raw HTML of a page. Browser rendering and a screenshot are optional.",
    inputSchema: scrapeHtmlInput,
    execute: async (input) => scrapeHtml(input, apiKey(options)),
    toModelOutput: screenshotModelOutput,
  });
}

/** Retrieve a page as Markdown. Browser rendering is optional. */
export function scrapeMarkdownTool(
  options: MrScraperToolOptions = {},
): Tool<ScrapeMarkdownInput, MrScraperResponse<PageData>> {
  return tool({
    description: "Retrieve a page as Markdown. Browser rendering is optional.",
    inputSchema: scrapeMarkdownInput,
    execute: async (input) => scrapeMarkdown(input, apiKey(options)),
  });
}

/**
 * Capture a base64 PNG screenshot of the full page, the top viewport, or a
 * custom viewport size. Browser rendering is always enabled. The model
 * receives the screenshot as an image.
 */
export function getScreenshotTool(
  options: MrScraperToolOptions = {},
): Tool<GetScreenshotInput, MrScraperResponse<PageData>> {
  return tool({
    description:
      "Capture a base64 PNG screenshot of the full page, the top viewport, or a custom viewport size. Browser rendering is always enabled.",
    inputSchema: getScreenshotInput,
    execute: async (input) => getScreenshot(input, apiKey(options)),
    toModelOutput: screenshotModelOutput,
  });
}

/** Extract a website's colors, typography, logos, and social links as JSON. */
export function scrapeBrandTool(options: MrScraperToolOptions = {}): Tool<ScrapeBrandInput, MrScraperResponse> {
  return tool({
    description: "Extract a website's colors, typography, logos, and social links as JSON.",
    inputSchema: scrapeBrandInput,
    execute: async (input) => scrapeBrand(input, apiKey(options)),
  });
}

/**
 * Extract structured JSON from a page using a natural-language prompt. Append
 * Json Schema: and a JSON schema to shape the output. A requested screenshot
 * reaches the model as an image.
 */
export function scrapeJsonTool(options: MrScraperToolOptions = {}): Tool<ScrapeJsonInput, MrScraperResponse> {
  return tool({
    description:
      "Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.",
    inputSchema: scrapeJsonInput,
    execute: async (input) => scrapeJson(input, apiKey(options)),
    toModelOutput: screenshotModelOutput,
  });
}

/** Search the web and return ranked results with titles, URLs, descriptions, and sources. */
export function webSearchTool(
  options: MrScraperToolOptions = {},
): Tool<WebSearchInput, MrScraperResponse<WebSearchResponse>> {
  return tool({
    description: "Search the web and return ranked results with titles, URLs, descriptions, and sources.",
    inputSchema: webSearchInput,
    execute: async (input) => webSearch(input, apiKey(options)),
  });
}

/** All seven MrScraper tools, keyed by the names the MrScraper MCP server uses. */
export function mrscraperTools(options: MrScraperToolOptions = {}): {
  status: Tool<StatusInput, MrScraperResponse>;
  scrapeHtml: Tool<ScrapeHtmlInput, MrScraperResponse<PageData>>;
  scrapeMarkdown: Tool<ScrapeMarkdownInput, MrScraperResponse<PageData>>;
  getScreenshot: Tool<GetScreenshotInput, MrScraperResponse<PageData>>;
  scrapeBrand: Tool<ScrapeBrandInput, MrScraperResponse>;
  scrapeJson: Tool<ScrapeJsonInput, MrScraperResponse>;
  webSearch: Tool<WebSearchInput, MrScraperResponse<WebSearchResponse>>;
} {
  return {
    status: statusTool(options),
    scrapeHtml: scrapeHtmlTool(options),
    scrapeMarkdown: scrapeMarkdownTool(options),
    getScreenshot: getScreenshotTool(options),
    scrapeBrand: scrapeBrandTool(options),
    scrapeJson: scrapeJsonTool(options),
    webSearch: webSearchTool(options),
  };
}
