import { asSchema, type Tool } from "ai";
import { describe, expect, it } from "vitest";

import { mrscraperTools } from "../src/index.js";

// Copied from the MrScraper Integrations Standard (service reference 0.5.0).
const parameters: Record<string, { name?: string; description: string; default?: unknown }> = {
  url: { description: "Absolute HTTP or HTTPS URL of the page to process." },
  timeout: {
    description: "Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds.",
    default: 300,
  },
  geoCode: { description: "Two-letter country code to load the page from, sent in lowercase.", default: "us" },
  proxyCountry: { description: "Two-letter country code of the proxy server, sent in lowercase.", default: "us" },
  super: { description: "Whether to route the request through real devices.", default: false },
  waitUntil: {
    description: "Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2.",
    default: "domcontentloaded",
  },
  proxy: { description: "Custom proxy URL used to load the page." },
  maxRetries: {
    description: "Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.",
  },
  saveResult: { description: "Whether to save the result to the dashboard Result tab.", default: false },
  blockResources: {
    description: "Whether to block images, fonts, and stylesheets while loading the page.",
    default: false,
  },
  waitForSelector: {
    description: "Wait for the page to contain the specified CSS selector before returning the result.",
  },
  returnCookie: { description: "Whether to include browser session cookies in the response.", default: false },
  browserRendering: {
    description: "Whether to render the page in a browser before returning the result.",
    default: false,
  },
  warmStart: {
    description: "Whether to enable warm start for more reliable scraping, at the cost of additional latency.",
    default: false,
  },
  html: { description: "Whether to include the page HTML in the response.", default: false },
  markdown: { description: "Whether to include the page Markdown in the response.", default: false },
  screenshotArea: {
    name: "screenshot",
    description: "Screenshot area to capture: full for the entire page or top for the top viewport.",
    default: "full",
  },
  includeScreenshot: {
    name: "screenshot",
    description: "Whether to include a base64 screenshot in the response.",
    default: false,
  },
  prompt: {
    description:
      "Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output.",
    default: "Extract all data as complete as possible.",
  },
  query: { description: "Search query text, trimmed before sending, containing 1 to 1000 characters." },
  country: { description: "Two-letter country code to search from, sent in lowercase.", default: "us" },
  numResults: {
    description:
      "Number of search results to request, as an integer from 10 to 100. Fewer results may be returned.",
    default: 10,
  },
};

const page = ["url", "timeout", "geoCode", "proxyCountry", "super", "waitUntil", "proxy", "maxRetries", "saveResult"];
const loading = ["blockResources", "waitForSelector", "returnCookie"];

const services: Record<
  string,
  { description: string; parameters: string[]; required: string[]; defaults?: Record<string, unknown> }
> = {
  status: {
    description:
      "Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.",
    parameters: [],
    required: [],
  },
  scrapeHtml: {
    description: "Retrieve the raw HTML of a page. Browser rendering is optional.",
    parameters: [...page, ...loading, "browserRendering", "warmStart"],
    required: ["url"],
  },
  scrapeMarkdown: {
    description:
      "Retrieve a page as Markdown. Including HTML also enables browser rendering and returns both outputs as JSON.",
    parameters: [...page, ...loading, "browserRendering", "warmStart", "html"],
    required: ["url"],
  },
  getScreenshot: {
    description:
      "Capture a base64 screenshot of the full page or top viewport. Browser rendering is always enabled.",
    parameters: [...page, ...loading, "screenshotArea", "html", "markdown"],
    required: ["url"],
    defaults: { html: true },
  },
  scrapeBrand: {
    description: "Extract a website's colors, typography, logos, and social links as JSON.",
    parameters: ["url"],
    required: ["url"],
  },
  scrapeJson: {
    description:
      "Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.",
    parameters: [...page, "prompt", "browserRendering", "html", "includeScreenshot"],
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

  it("returns the seven standard tools under their Node SDK and MCP names", () => {
    expect(Object.keys(tools)).toEqual(Object.keys(services));
  });

  it.each(Object.entries(services))("%s uses the standard description and input fields", async (name, service) => {
    const tool: Tool = tools[name as keyof typeof tools];
    expect(tool.description).toBe(service.description);
    const schema = await asSchema(tool.inputSchema).jsonSchema;
    const properties = (schema.properties ?? {}) as Record<string, { description?: string; default?: unknown }>;
    expect(Object.keys(properties)).toEqual(service.parameters.map((key) => parameters[key]!.name ?? key));
    expect(schema.required ?? []).toEqual(service.required);
    expect(schema.additionalProperties).toBe(false);
    for (const key of service.parameters) {
      const parameter = parameters[key]!;
      const property = properties[parameter.name ?? key]!;
      expect(property.description, key).toBe(parameter.description);
      const expectedDefault = service.defaults && key in service.defaults ? service.defaults[key] : parameter.default;
      expect(property.default, key).toEqual(expectedDefault);
    }
  });
});
