import { z } from "zod/v4";

// Tool inputs follow MrScraper's integration parameter spec (2026-11-24), which
// matches the API reference at https://docs.mrscraper.com/docs/api. Copy
// description text exactly when changing them. Inputs without a default are
// sent only when the model sets them, so the API default applies otherwise.

const url = z
  .url({ protocol: /^https?$/ })
  .describe("URL of the page to scrape. Must include the protocol (https://).");

const browserRendering = z
  .boolean()
  .optional()
  .describe(
    "Controls whether the page is loaded in a browser. Leave it out to load the page without a browser first and switch to a browser automatically if the request is blocked. Set true to always load the page in a browser, which JavaScript-heavy sites, SPAs, and pages that load content dynamically need. Set false to never use a browser.",
  );

const timeout = z
  .number()
  .int()
  .min(1)
  .max(330)
  .optional()
  .describe(
    "Maximum seconds to wait for the scrape before the request times out, from 1 to 330. Increase for slow or complex pages. Defaults to 300.",
  );

const warmStart = z
  .boolean()
  .optional()
  .describe(
    "Opens the site's home page first to warm the session before loading the target URL. Useful for sites that expect a normal browsing session before deeper pages.",
  );

const blockResources = z
  .boolean()
  .optional()
  .describe("Blocks images, fonts, and stylesheets from loading. Speeds up scraping and reduces bandwidth usage.");

const waitForSelector = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .optional()
  .describe(
    "Waits until a specific CSS selector or text appears on the page before returning it, such as #results. Up to 500 characters. Useful for content that loads asynchronously after the initial page load.",
  );

/** Two letters, sent in lowercase. */
const countryCode = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .toLowerCase();

const geoCode = countryCode
  .optional()
  .describe("Two-letter country code to load the page from, such as us or gb. Defaults to the United States.");

const maxAge = z
  .number()
  .int()
  .min(0)
  .max(604_800_000)
  .default(0)
  .describe(
    "Serves a cached result of the same request when it is newer than this age, in milliseconds, such as 86400000 for 1 day. Up to 604800000 (7 days). 0, the default, always scrapes fresh. A cached result costs the same tokens as the original scrape.",
  );

const maxRetries = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe("Maximum number of retries for the request. Omit for no limit.");

/** Width and height from 100 to 3840 pixels, zoom from 25 to 300 percent. */
function screenshotSizeInRange(value: string): boolean {
  const size = /^(\d+)x(\d+)(?:-(\d+))?$/.exec(value);
  if (!size) return true;
  const within = (text: string | undefined, min: number, max: number) =>
    text === undefined || (Number(text) >= min && Number(text) <= max);
  return within(size[1], 100, 3840) && within(size[2], 100, 3840) && within(size[3], 25, 300);
}

/** full, top, or <width>x<height> with an optional -<zoom>. */
const screenshotArea = z
  .string()
  .regex(/^(full|top|[0-9]{3,4}x[0-9]{3,4}(-[0-9]{2,3})?)$/)
  .refine(screenshotSizeInRange, "Width and height range from 100 to 3840, zoom from 25 to 300.");

export const statusInput = z.strictObject({});

export const scrapeHtmlInput = z.strictObject({
  url,
  browserRendering,
  timeout,
  warmStart,
  blockResources,
  waitForSelector,
  geoCode,
  maxAge,
  maxRetries,
  screenshot: screenshotArea
    .optional()
    .describe(
      "Also captures a screenshot of the rendered page as a base64-encoded PNG: full captures the entire scroll height, top captures the first viewport, and <width>x<height> sets the viewport size in pixels with an optional -<zoom> percent, such as 1280x800 or 1920x1080-75. Width and height range from 100 to 3840, zoom from 25 to 300. Setting it forces browser rendering. Leave it out for no screenshot.",
    ),
});

export const scrapeMarkdownInput = z.strictObject({
  url,
  browserRendering,
  timeout,
  geoCode,
  warmStart,
  blockResources,
  waitForSelector,
  maxAge,
  maxRetries,
});

export const getScreenshotInput = z.strictObject({
  url,
  screenshot: screenshotArea
    .default("full")
    .describe(
      "Screenshot area: full captures the entire scroll height (the default), top captures the first viewport, and <width>x<height> sets the viewport size in pixels with an optional -<zoom> percent, such as 1280x800 or 1920x1080-75. Width and height range from 100 to 3840, zoom from 25 to 300. The image is a base64-encoded PNG.",
    ),
  timeout,
  geoCode,
  waitForSelector,
  maxAge,
  maxRetries,
});

export const scrapeBrandInput = z.strictObject({ url });

export const scrapeJsonInput = z.strictObject({
  url,
  prompt: z
    .string()
    .min(1)
    .refine((value) => value.trim() !== "", "prompt must be non-empty")
    .optional()
    .describe(
      'Description of the data shape you want back, for example fields like title, price, and rating. The prompt only parses the scraped content; it cannot instruct the scraper itself. To shape the output with a JSON schema, append it to the prompt as a Json Schema: section. Defaults to "Extract all data as complete as possible."',
    ),
  html: z
    .boolean()
    .default(true)
    .describe("Returns the raw HTML of the scraped page in the response. On by default; set false to leave it out."),
  screenshot: z
    .boolean()
    .default(false)
    .describe(
      "Captures a screenshot of the rendered page as a base64-encoded image. Useful for verifying what the scraper actually saw. Off by default.",
    ),
  browserRendering,
  waitForSelector,
  warmStart,
  blockResources,
  timeout,
  geoCode,
  maxAge,
  maxRetries,
});

export const webSearchInput = z.strictObject({
  query: z
    .string()
    .trim()
    .min(1)
    .refine((value) => [...value].length <= 1000, "query must be 1 to 1000 characters")
    .describe("The search query, from 1 to 1000 characters."),
  country: countryCode
    .optional()
    .describe("Two-letter country code to run the search from. Defaults to the United States."),
  numResults: z
    .number()
    .int()
    .min(10)
    .max(100)
    .optional()
    .describe("How many results to return, from 10 to 100. The search may return fewer. Defaults to 10."),
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
/** Input of the webSearch tool after validation. */
export type WebSearchInput = z.infer<typeof webSearchInput>;
