import { asSchema, type Tool } from "ai";
import { describe, expect, it } from "vitest";

import { mrscraperTools } from "../src/index.js";

const SCREENSHOT_PATTERN = "^(full|top|[0-9]{3,4}x[0-9]{3,4}(-[0-9]{2,3})?)$";

// Descriptions copied from MrScraper's integration parameter spec (2026-11-24).
const parameters: Record<
  string,
  { name?: string; description: string; schema: Record<string, unknown>; default?: unknown }
> = {
  url: {
    description: "URL of the page to scrape. Must include the protocol (https://).",
    schema: { type: "string", format: "uri" },
  },
  browserRendering: {
    description:
      "Controls whether the page is loaded in a browser. Leave it out to load the page without a browser first and switch to a browser automatically if the request is blocked. Set true to always load the page in a browser, which JavaScript-heavy sites, SPAs, and pages that load content dynamically need. Set false to never use a browser.",
    schema: { type: "boolean" },
  },
  timeout: {
    description:
      "Maximum seconds to wait for the scrape before the request times out, from 1 to 330. Increase for slow or complex pages. Defaults to 300.",
    schema: { type: "integer", minimum: 1, maximum: 330 },
  },
  warmStart: {
    description:
      "Opens the site's home page first to warm the session before loading the target URL. Useful for sites that expect a normal browsing session before deeper pages.",
    schema: { type: "boolean" },
  },
  blockResources: {
    description: "Blocks images, fonts, and stylesheets from loading. Speeds up scraping and reduces bandwidth usage.",
    schema: { type: "boolean" },
  },
  waitForSelector: {
    description:
      "Waits until a specific CSS selector or text appears on the page before returning it, such as #results. Up to 500 characters. Useful for content that loads asynchronously after the initial page load.",
    schema: { type: "string", minLength: 1, maxLength: 500 },
  },
  geoCode: {
    description: "Two-letter country code to load the page from, such as us or gb. Defaults to the United States.",
    schema: { type: "string", pattern: "^[A-Za-z]{2}$" },
  },
  maxAge: {
    description:
      "Serves a cached result of the same request when it is newer than this age, in milliseconds, such as 86400000 for 1 day. Up to 604800000 (7 days). 0, the default, always scrapes fresh. A cached result costs the same tokens as the original scrape.",
    schema: { type: "integer", minimum: 0, maximum: 604800000 },
    default: 0,
  },
  maxRetries: {
    description: "Maximum number of retries for the request. Omit for no limit.",
    schema: { type: "integer", minimum: 0 },
  },
  htmlScreenshot: {
    name: "screenshot",
    description:
      "Also captures a screenshot of the rendered page as a base64-encoded PNG: full captures the entire scroll height, top captures the first viewport, and <width>x<height> sets the viewport size in pixels with an optional -<zoom> percent, such as 1280x800 or 1920x1080-75. Width and height range from 100 to 3840, zoom from 25 to 300. Setting it forces browser rendering. Leave it out for no screenshot.",
    schema: { type: "string", pattern: SCREENSHOT_PATTERN },
  },
  screenshotArea: {
    name: "screenshot",
    description:
      "Screenshot area: full captures the entire scroll height (the default), top captures the first viewport, and <width>x<height> sets the viewport size in pixels with an optional -<zoom> percent, such as 1280x800 or 1920x1080-75. Width and height range from 100 to 3840, zoom from 25 to 300. The image is a base64-encoded PNG.",
    schema: { type: "string", pattern: SCREENSHOT_PATTERN },
    default: "full",
  },
  jsonScreenshot: {
    name: "screenshot",
    description:
      "Captures a screenshot of the rendered page as a base64-encoded image. Useful for verifying what the scraper actually saw. Off by default.",
    schema: { type: "boolean" },
    default: false,
  },
  html: {
    description: "Returns the raw HTML of the scraped page in the response. On by default; set false to leave it out.",
    schema: { type: "boolean" },
    default: true,
  },
  prompt: {
    description:
      'Description of the data shape you want back, for example fields like title, price, and rating. The prompt only parses the scraped content; it cannot instruct the scraper itself. To shape the output with a JSON schema, append it to the prompt as a Json Schema: section. Defaults to "Extract all data as complete as possible."',
    schema: { type: "string", minLength: 1 },
  },
  query: {
    description: "The search query, from 1 to 1000 characters.",
    schema: { type: "string", minLength: 1 },
  },
  country: {
    description: "Two-letter country code to run the search from. Defaults to the United States.",
    schema: { type: "string", pattern: "^[A-Za-z]{2}$" },
  },
  numResults: {
    description: "How many results to return, from 10 to 100. The search may return fewer. Defaults to 10.",
    schema: { type: "integer", minimum: 10, maximum: 100 },
  },
};

// Tool descriptions and exposed inputs, in the spec's order.
const services: Record<string, { description: string; parameters: string[]; required: string[] }> = {
  status: {
    description:
      "Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.",
    parameters: [],
    required: [],
  },
  scrapeHtml: {
    description: "Retrieve the raw HTML of a page. Browser rendering and a screenshot are optional.",
    parameters: [
      "url",
      "browserRendering",
      "timeout",
      "warmStart",
      "blockResources",
      "waitForSelector",
      "geoCode",
      "maxAge",
      "maxRetries",
      "htmlScreenshot",
    ],
    required: ["url"],
  },
  scrapeMarkdown: {
    description: "Retrieve a page as Markdown. Browser rendering is optional.",
    parameters: [
      "url",
      "browserRendering",
      "timeout",
      "geoCode",
      "warmStart",
      "blockResources",
      "waitForSelector",
      "maxAge",
      "maxRetries",
    ],
    required: ["url"],
  },
  getScreenshot: {
    description:
      "Capture a base64 PNG screenshot of the full page, the top viewport, or a custom viewport size. Browser rendering is always enabled.",
    parameters: ["url", "screenshotArea", "timeout", "geoCode", "waitForSelector", "maxAge", "maxRetries"],
    required: ["url"],
  },
  scrapeBrand: {
    description: "Extract a website's colors, typography, logos, and social links as JSON.",
    parameters: ["url"],
    required: ["url"],
  },
  scrapeJson: {
    description:
      "Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.",
    parameters: [
      "url",
      "prompt",
      "html",
      "jsonScreenshot",
      "browserRendering",
      "waitForSelector",
      "warmStart",
      "blockResources",
      "timeout",
      "geoCode",
      "maxAge",
      "maxRetries",
    ],
    required: ["url"],
  },
  webSearch: {
    description: "Search the web and return ranked results with titles, URLs, descriptions, and sources.",
    parameters: ["query", "country", "numResults"],
    required: ["query"],
  },
};

describe("mrscraperTools", () => {
  const tools = mrscraperTools({ apiKey: "atk_testtesttesttest" });

  it("returns the seven tools under their MCP names", () => {
    expect(Object.keys(tools)).toEqual(Object.keys(services));
  });

  it.each(Object.entries(services))("%s has the spec's description and inputs", async (name, service) => {
    const tool: Tool = tools[name as keyof typeof tools];
    expect(tool.description).toBe(service.description);
    const schema = await asSchema(tool.inputSchema).jsonSchema;
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    expect(Object.keys(properties)).toEqual(service.parameters.map((key) => parameters[key]!.name ?? key));
    expect(schema.required ?? []).toEqual(service.required);
    expect(schema.additionalProperties).toBe(false);
    for (const key of service.parameters) {
      const parameter = parameters[key]!;
      const property = properties[parameter.name ?? key]!;
      expect(property, key).toMatchObject({ description: parameter.description, ...parameter.schema });
      expect(property.default, key).toEqual(parameter.default);
    }
  });
});
