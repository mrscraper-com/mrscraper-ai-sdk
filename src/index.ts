import { account, scraper_api, web_search, type AccountSummary } from "@mrscraper/sdk";
import { tool, type Tool } from "ai";
import { z } from "zod/v4";

import {
  toPageModelOutput,
  toPageResult,
  toSearchResult,
  type PageFormat,
  type PageResult,
  type SearchResult,
} from "./results.js";

export type { AccountSummary } from "@mrscraper/sdk";
export type {
  PageFormat,
  PageResult,
  SearchResult,
  SearchResultItem,
} from "./results.js";

/** Input of the scraperAPI tool after validation. */
export interface ScraperApiInput {
  url: string;
  formats: PageFormat[];
  browserRendering?: boolean;
  waitForSelector?: string;
  geoCode?: string;
  timeout?: number;
}

/** Input of the webSearch tool after validation. */
export interface WebSearchInput {
  query: string;
  region?: string;
  language?: string;
  page?: number;
}

export interface MrScraperToolOptions {
  /**
   * MrScraper API key from https://app.mrscraper.com/api-tokens. Defaults to
   * the MRSCRAPER_API_KEY environment variable, then MRSCRAPER_API_TOKEN.
   */
  apiKey?: string;
}

function apiKey(options: MrScraperToolOptions): string | undefined {
  return options.apiKey ?? process.env.MRSCRAPER_API_KEY ?? undefined;
}

const formatSchema = z.enum(["markdown", "html", "screenshot"]);

/**
 * Retrieves a known public page as Markdown, HTML, a screenshot, or a
 * combination through MrScraper's Scraper API.
 */
export function scraperApiTool(options: MrScraperToolOptions = {}): Tool<ScraperApiInput, PageResult> {
  return tool({
    description:
      "Retrieve a known public web page through MrScraper as Markdown, HTML, a screenshot, or a combination. " +
      "Use Markdown for reading and summarizing; add html when exact markup or attributes matter. " +
      "MrScraper renders JavaScript-heavy pages in a browser when needed. Each call uses MrScraper plan tokens.",
    inputSchema: z.object({
      url: z.url({ protocol: /^https?$/ }).describe("Absolute http or https URL of the page."),
      formats: z
        .array(formatSchema)
        .min(1)
        .default(["markdown"])
        .describe("Representations to return. Defaults to markdown."),
      browserRendering: z
        .boolean()
        .optional()
        .describe("true forces a real browser, false disables it; omit for automatic fallback."),
      waitForSelector: z
        .string()
        .min(1)
        .optional()
        .describe("CSS selector to wait for before the page is captured."),
      geoCode: z
        .string()
        .length(2)
        .optional()
        .describe("Two-letter country code for the request location, such as US or GB."),
      timeout: z
        .number()
        .int()
        .min(1)
        .max(300)
        .optional()
        .describe("Page timeout in seconds, 1 to 300. Defaults to 120."),
    }),
    async execute({ url, formats, browserRendering, waitForSelector, geoCode, timeout }) {
      const requested = new Set<PageFormat>(formats);
      const response = await scraper_api(url, {
        token: apiKey(options),
        markdown: requested.has("markdown"),
        html: requested.has("html"),
        screenshot: requested.has("screenshot"),
        browser_rendering: browserRendering ?? null,
        wait_for_selector: waitForSelector ?? null,
        ...(geoCode === undefined ? {} : { geo_code: geoCode.toUpperCase() }),
        ...(timeout === undefined ? {} : { timeout }),
      });
      return toPageResult(url, [...requested], response);
    },
    toModelOutput: ({ output }) => toPageModelOutput(output),
  });
}

/** Searches Google through MrScraper and returns parsed organic results. */
export function webSearchTool(options: MrScraperToolOptions = {}): Tool<WebSearchInput, SearchResult> {
  return tool({
    description:
      "Search Google through MrScraper and get parsed organic results (rank, title, link, description, source). " +
      "Use it to discover pages when no URL is known, then retrieve chosen pages with the scraperAPI tool. " +
      "Each call uses MrScraper plan tokens.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("Search terms, or a complete Google search URL."),
      region: z
        .string()
        .length(2)
        .optional()
        .describe("Two-letter country code for the results, such as us, gb, or id."),
      language: z
        .string()
        .min(2)
        .max(5)
        .optional()
        .describe("Language code for the results, such as en or id."),
      page: z.number().int().min(1).optional().describe("One-based result page."),
    }),
    async execute({ query, region, language, page }) {
      const response = await web_search(query, {
        token: apiKey(options),
        raw: false,
        format: "json",
        region: region ?? null,
        language: language ?? null,
        page: page ?? null,
      });
      return toSearchResult(query, response);
    },
  });
}

/** Reports the MrScraper plan, token usage, and remaining tokens. */
export function accountStatusTool(
  options: MrScraperToolOptions = {},
): Tool<Record<string, never>, AccountSummary> {
  return tool({
    description:
      "Show the connected MrScraper account's subscription status, token limit, tokens used, and tokens remaining. " +
      "Uses no tokens.",
    inputSchema: z.object({}),
    async execute() {
      const response = await account({ token: apiKey(options) });
      return response.data;
    },
  });
}

/** All MrScraper tools, keyed by the names the MrScraper MCP server uses. */
export function mrscraperTools(options: MrScraperToolOptions = {}): {
  scraperAPI: Tool<ScraperApiInput, PageResult>;
  webSearch: Tool<WebSearchInput, SearchResult>;
  status: Tool<Record<string, never>, AccountSummary>;
} {
  return {
    scraperAPI: scraperApiTool(options),
    webSearch: webSearchTool(options),
    status: accountStatusTool(options),
  };
}
