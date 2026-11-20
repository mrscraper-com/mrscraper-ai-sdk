import { z } from "zod/v4";

// Field names, defaults, and descriptions follow the MrScraper Integrations
// Standard. Copy description text exactly when changing them.

const url = z.url({ protocol: /^https?$/ }).describe("Absolute HTTP or HTTPS URL of the page to process.");

const countryCode = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .default("us");

/** Page controls shared by HTML, Markdown, screenshots, and JSON extraction. */
const page = {
  url,
  timeout: z
    .number()
    .int()
    .min(1)
    .max(300)
    .default(300)
    .describe("Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds."),
  geoCode: countryCode.describe("Two-letter country code to load the page from, sent in lowercase."),
  proxyCountry: countryCode.describe("Two-letter country code of the proxy server, sent in lowercase."),
  super: z.boolean().default(false).describe("Whether to route the request through real devices."),
  waitUntil: z
    .enum(["domcontentloaded", "load", "networkidle0", "networkidle2"])
    .default("domcontentloaded")
    .describe("Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2."),
  proxy: z.string().trim().min(1).optional().describe("Custom proxy URL used to load the page."),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit."),
  saveResult: z.boolean().default(false).describe("Whether to save the result to the dashboard Result tab."),
};

/** Loading controls shared by HTML, Markdown, and screenshots. */
const loading = {
  blockResources: z
    .boolean()
    .default(false)
    .describe("Whether to block images, fonts, and stylesheets while loading the page."),
  waitForSelector: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Wait for the page to contain the specified CSS selector before returning the result."),
  returnCookie: z.boolean().default(false).describe("Whether to include browser session cookies in the response."),
};

const browserRendering = z
  .boolean()
  .default(false)
  .describe("Whether to render the page in a browser before returning the result.");

const warmStart = z
  .boolean()
  .default(false)
  .describe("Whether to enable warm start for more reliable scraping, at the cost of additional latency.");

function html(defaultValue: boolean) {
  return z.boolean().default(defaultValue).describe("Whether to include the page HTML in the response.");
}

export const statusInput = z.strictObject({});

export const scrapeHtmlInput = z.strictObject({ ...page, ...loading, browserRendering, warmStart });

export const scrapeMarkdownInput = z.strictObject({
  ...page,
  ...loading,
  browserRendering,
  warmStart,
  html: html(false),
});

export const getScreenshotInput = z.strictObject({
  ...page,
  ...loading,
  screenshot: z
    .enum(["full", "top"])
    .default("full")
    .describe("Screenshot area to capture: full for the entire page or top for the top viewport."),
  html: html(true),
  markdown: z.boolean().default(false).describe("Whether to include the page Markdown in the response."),
});

export const scrapeBrandInput = z.strictObject({ url });

export const scrapeJsonInput = z.strictObject({
  ...page,
  prompt: z
    .string()
    .min(1)
    .refine((value) => value.trim() !== "", "prompt must be non-empty")
    .default("Extract all data as complete as possible.")
    .describe(
      "Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output.",
    ),
  browserRendering,
  html: html(false),
  screenshot: z.boolean().default(false).describe("Whether to include a base64 screenshot in the response."),
});

export const webSearchInput = z.strictObject({
  query: z
    .string()
    .trim()
    .min(1)
    .refine((value) => [...value].length <= 1000, "query must be 1 to 1000 characters")
    .describe("Search query text, trimmed before sending, containing 1 to 1000 characters."),
  country: countryCode.describe("Two-letter country code to search from, sent in lowercase."),
  numResults: z
    .number()
    .int()
    .min(10)
    .max(100)
    .default(10)
    .describe("Number of search results to request, as an integer from 10 to 100. Fewer results may be returned."),
});

/** Input of the status tool after validation. */
export type StatusInput = z.infer<typeof statusInput>;
/** Input of the scrapeHtml tool after validation and defaults. */
export type ScrapeHtmlInput = z.infer<typeof scrapeHtmlInput>;
/** Input of the scrapeMarkdown tool after validation and defaults. */
export type ScrapeMarkdownInput = z.infer<typeof scrapeMarkdownInput>;
/** Input of the getScreenshot tool after validation and defaults. */
export type GetScreenshotInput = z.infer<typeof getScreenshotInput>;
/** Input of the scrapeBrand tool after validation. */
export type ScrapeBrandInput = z.infer<typeof scrapeBrandInput>;
/** Input of the scrapeJson tool after validation and defaults. */
export type ScrapeJsonInput = z.infer<typeof scrapeJsonInput>;
/** Input of the webSearch tool after validation and defaults. */
export type WebSearchInput = z.infer<typeof webSearchInput>;
