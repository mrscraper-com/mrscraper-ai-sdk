# MrScraper tools for the AI SDK

[MrScraper](https://mrscraper.com) tools for the [Vercel AI SDK](https://ai-sdk.dev):
retrieve public web pages as HTML, Markdown, or screenshots, extract brand
details and structured JSON, search the web, and check your MrScraper account
status.

## Overview

The seven MrScraper services as AI SDK tools, with the same names and
descriptions as the [MrScraper MCP server](https://github.com/mrscraper-com/mrscraper-mcp).
Inputs follow the [API Reference](https://docs.mrscraper.com/docs/api/overview).
The tools call the MrScraper API directly with `fetch`; besides the `ai` and
`zod` peer dependencies, the package has no dependencies.

| Tool | Factory | Description |
| --- | --- | --- |
| `status` | `statusTool()` | Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields. |
| `scrapeHtml` | `scrapeHtmlTool()` | Retrieve the raw HTML of a page. Browser rendering and a screenshot are optional. |
| `scrapeMarkdown` | `scrapeMarkdownTool()` | Retrieve a page as Markdown. Browser rendering is optional. |
| `getScreenshot` | `getScreenshotTool()` | Capture a base64 PNG screenshot of the full page, the top viewport, or a custom viewport size. Browser rendering is always enabled. |
| `scrapeBrand` | `scrapeBrandTool()` | Extract a website's colors, typography, logos, and social links as JSON. |
| `scrapeJson` | `scrapeJsonTool()` | Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output. |
| `webSearch` | `webSearchTool()` | Search the web and return ranked results with titles, URLs, descriptions, and sources. |

`mrscraperTools()` returns all seven, keyed by tool name.

## Installation

```bash
npm install @mrscraper/ai-sdk ai zod
```

Requires AI SDK 7 and Node.js 18 or later.

## Authentication

Get an API key at [app.mrscraper.com/api-tokens](https://app.mrscraper.com/api-tokens)
and set it as `MRSCRAPER_API_KEY`, or pass `apiKey` to `mrscraperTools()` or a
tool factory. The tools use `apiKey`, then `MRSCRAPER_API_KEY`, then
`MRSCRAPER_API_TOKEN`. The key is sent in request headers. It is not a tool
input, so the model never sees it.

## Quickstart

```ts
import { generateText, isStepCount } from "ai";
import { mrscraperTools } from "@mrscraper/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5",
  prompt: "Read https://example.com as Markdown and summarize it in two sentences.",
  tools: mrscraperTools(),
  stopWhen: isStepCount(5),
});

console.log(text);
```

Pick individual tools when you only need some of them:

```ts
import { scrapeMarkdownTool, webSearchTool } from "@mrscraper/ai-sdk";

const tools = {
  scrapeMarkdown: scrapeMarkdownTool({ apiKey: process.env.MRSCRAPER_API_KEY }),
  webSearch: webSearchTool(),
};
```

Examples use `example.com` as the sample target. Replace it for your use case.
Live scraping and search calls consume account quota.

## Page controls

`scrapeHtml`, `scrapeMarkdown`, `getScreenshot`, and `scrapeJson` load a page
and share these inputs. An input without a default is sent only when the model
sets it, so the API's own default applies otherwise. Every request from these
four tools also sends `saveResult=true`, so its result appears in the Result
tab of your MrScraper dashboard.

| Parameter | Type | Default | Tools | Description |
| --- | --- | --- | --- | --- |
| `url` | string | Required | all four | URL of the page to scrape. Must include the protocol (https://). |
| `browserRendering` | boolean | Not sent | all but `getScreenshot` | Controls whether the page is loaded in a browser. Leave it out to load the page without a browser first and switch to a browser automatically if the request is blocked. Set true to always load the page in a browser, which JavaScript-heavy sites, SPAs, and pages that load content dynamically need. Set false to never use a browser. |
| `timeout` | integer, 1 to 330 | Not sent | all four | Maximum seconds to wait for the scrape before the request times out, from 1 to 330. Increase for slow or complex pages. Defaults to 300. |
| `warmStart` | boolean | Not sent | all but `getScreenshot` | Opens the site's home page first to warm the session before loading the target URL. Useful for sites that expect a normal browsing session before deeper pages. |
| `blockResources` | boolean | Not sent | all but `getScreenshot` | Blocks images, fonts, and stylesheets from loading. Speeds up scraping and reduces bandwidth usage. |
| `waitForSelector` | string, 1 to 500 characters | Not sent | all four | Waits until a specific CSS selector or text appears on the page before returning it, such as #results. Up to 500 characters. Useful for content that loads asynchronously after the initial page load. |
| `geoCode` | string, two letters | Not sent | all four | Two-letter country code to load the page from, such as us or gb. Defaults to the United States. |
| `maxAge` | integer, 0 to 604800000 | `0` | all four | Serves a cached result of the same request when it is newer than this age, in milliseconds, such as 86400000 for 1 day. Up to 604800000 (7 days). 0, the default, always scrapes fresh. A cached result costs the same tokens as the original scrape. |
| `maxRetries` | integer, 0 or more | Not sent | all four | Maximum number of retries for the request. Omit for no limit. |

Country codes are sent in lowercase. The HTTP request allows the page timeout
(300 seconds when `timeout` is not set) plus 30 seconds.

## Service reference

### Status

Tool `status`, factory `statusTool()`.

Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.

This service takes no inputs. The request is
`GET https://api.app.mrscraper.com/api/v1/subscription-accounts`, with a fixed
HTTP deadline of 600 seconds.

Response: The API body contains message and data. Account details remain
nested in data, including subscriptionItem and scraperAllowance. The response
envelope therefore exposes account details at data.data. Sensitive response
headers are removed.

### Scrape HTML

Tool `scrapeHtml`, factory `scrapeHtmlTool()`.

Retrieve the raw HTML of a page. Browser rendering and a screenshot are optional.

Inputs, in order: `url`, `browserRendering`, `timeout`, `warmStart`,
`blockResources`, `waitForSelector`, `geoCode`, `maxAge`, `maxRetries` (see
[Page controls](#page-controls)), and:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `screenshot` | string: `full`, `top`, or `<width>x<height>[-<zoom>]` | Not sent | Also captures a screenshot of the rendered page as a base64-encoded PNG: full captures the entire scroll height, top captures the first viewport, and <width>x<height> sets the viewport size in pixels with an optional -<zoom> percent, such as 1280x800 or 1920x1080-75. Width and height range from 100 to 3840, zoom from 25 to 300. Setting it forces browser rendering. Leave it out for no screenshot. |

Always sent: `html=true`, `markdown=false`, `saveResult=true`.

Example input and the request it sends:

```json
{
  "url": "https://example.com",
  "browserRendering": true,
  "waitForSelector": "#results",
  "screenshot": "1280x800"
}
```

```text
GET https://api.mrscraper.com/?url=https%3A%2F%2Fexample.com&browserRendering=true&waitForSelector=%23results&maxAge=0&screenshot=1280x800&html=true&markdown=false&saveResult=true
```

Response: HTML text. With `screenshot` set, JSON with `html` and `screenshot`.

### Scrape Markdown

Tool `scrapeMarkdown`, factory `scrapeMarkdownTool()`.

Retrieve a page as Markdown. Browser rendering is optional.

Inputs, in order: `url`, `browserRendering`, `timeout`, `geoCode`,
`warmStart`, `blockResources`, `waitForSelector`, `maxAge`, `maxRetries` (see
[Page controls](#page-controls)).

Always sent: `markdown=true`, `html=false`, `screenshot=false`,
`saveResult=true`.

Example input and the request it sends:

```json
{
  "url": "https://example.com",
  "geoCode": "gb",
  "maxAge": 86400000
}
```

```text
GET https://api.mrscraper.com/?url=https%3A%2F%2Fexample.com&geoCode=gb&maxAge=86400000&markdown=true&html=false&screenshot=false&saveResult=true
```

Response: Markdown text.

### Get screenshot

Tool `getScreenshot`, factory `getScreenshotTool()`.

Capture a base64 PNG screenshot of the full page, the top viewport, or a custom viewport size. Browser rendering is always enabled.

Inputs, in order: `url`, `screenshot`, `timeout`, `geoCode`,
`waitForSelector`, `maxAge`, `maxRetries` (see [Page controls](#page-controls)).

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `screenshot` | string: `full`, `top`, or `<width>x<height>[-<zoom>]` | `"full"` | Screenshot area: full captures the entire scroll height (the default), top captures the first viewport, and <width>x<height> sets the viewport size in pixels with an optional -<zoom> percent, such as 1280x800 or 1920x1080-75. Width and height range from 100 to 3840, zoom from 25 to 300. The image is a base64-encoded PNG. |

Always sent: `browserRendering=true`, `html=false`, `markdown=false`,
`saveResult=true`.

Example input and the request it sends:

```json
{
  "url": "https://example.com",
  "screenshot": "1920x1080-75"
}
```

```text
GET https://api.mrscraper.com/?url=https%3A%2F%2Fexample.com&screenshot=1920x1080-75&maxAge=0&browserRendering=true&html=false&markdown=false&saveResult=true
```

Response: JSON with the base64 PNG in `screenshot`.

### Scrape brand

Tool `scrapeBrand`, factory `scrapeBrandTool()`.

Extract a website's colors, typography, logos, and social links as JSON.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string | Required | URL of the page to scrape. Must include the protocol (https://). |

The request is
`GET https://api.mrscraper.com/?action=brand-scraping&url=…&bundle=none`, with
a fixed HTTP deadline of 120 seconds. Page controls are not accepted.

Response: The API body contains message and a data object with job_id,
status, url, final_url, brand, and error. Brand details are available at
data.data.brand in the response envelope.

### Scrape JSON

Tool `scrapeJson`, factory `scrapeJsonTool()`.

Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.

Inputs, in order: `url`, `prompt`, `html`, `screenshot`, `browserRendering`,
`waitForSelector`, `warmStart`, `blockResources`, `timeout`, `geoCode`,
`maxAge`, `maxRetries` (see [Page controls](#page-controls)), where:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `prompt` | string | Not sent | Description of the data shape you want back, for example fields like title, price, and rating. The prompt only parses the scraped content; it cannot instruct the scraper itself. To shape the output with a JSON schema, append it to the prompt as a Json Schema: section. Defaults to "Extract all data as complete as possible." |
| `html` | boolean | `true` | Returns the raw HTML of the scraped page in the response. On by default; set false to leave it out. |
| `screenshot` | boolean | `false` | Captures a screenshot of the rendered page as a base64-encoded image. Useful for verifying what the scraper actually saw. Off by default. |

Always sent: `agent=general`, `saveResult=true`. The request is a GET. If its
URL would exceed 8,000 characters, it switches to POST with `url`, `prompt`,
and `agent` in a JSON body; the other values stay in the query.

Example input and the request it sends:

```json
{
  "url": "https://example.com",
  "prompt": "Extract the first 2 items with title and price.",
  "html": false
}
```

```text
GET https://api.mrscraper.com/?url=https%3A%2F%2Fexample.com&prompt=Extract+the+first+2+items+with+title+and+price.&html=false&screenshot=false&maxAge=0&saveResult=true&agent=general
```

Response: Extraction results are in the API body's data field and follow the
requested schema, plus `html` by default and `screenshot` when requested.

### Web search

Tool `webSearch`, factory `webSearchTool()`.

Search the web and return ranked results with titles, URLs, descriptions, and sources.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | string, trimmed, 1 to 1000 characters | Required | The search query, from 1 to 1000 characters. |
| `country` | string, two letters | Not sent | Two-letter country code to run the search from. Defaults to the United States. |
| `numResults` | integer, 10 to 100 | Not sent | How many results to return, from 10 to 100. The search may return fewer. Defaults to 10. |

Always sent: `action=websearch`. The HTTP deadline is fixed at 120 seconds.

Example input and the request it sends:

```json
{
  "query": "site:example.com documentation",
  "country": "ID",
  "numResults": 20
}
```

```text
GET https://api.mrscraper.com/?action=websearch&query=site%3Aexample.com+documentation&country=id&numResults=20
```

Response: The API body contains success, message, a data array, and
tokenUsage. Each result includes rank, title, url, description, and source.

## Response format

Each tool returns the response envelope (`MrScraperResponse`) containing
`status_code`, `data`, and `headers`. The `data` field contains the API
response body; its field names are not converted. Credential headers are
removed. Status preserves the complete body without adding summary fields.

```json
{
  "status_code": 200,
  "data": "<html><body>Example page content...</body></html>",
  "headers": {
    "content-type": "text/html; charset=utf-8"
  }
}
```

The AI SDK sends tool results to the model as JSON. `getScreenshot`, and
`scrapeHtml` or `scrapeJson` when a screenshot is requested, send the base64
screenshot as an image part instead, so a screenshot costs image tokens rather
than hundreds of thousands of text tokens. Your code still receives the base64
string in `data.screenshot`.

## Error handling

Authentication, HTTP, network, and timeout failures throw `MrScraperError`,
exported by this package, with the API key redacted. Its `status` property is
the HTTP status when available. The AI SDK reports a thrown error to the model
as a tool error. Inputs that do not match a tool's schema, including fields
the tool does not define, are rejected before any request.

## Integration features

### Configuration

`mrscraperTools()` and each factory accept `{ apiKey }`. TypeScript exports
include `MrScraperToolOptions`, `MrScraperError`, an input type per tool
(`StatusInput`, `ScrapeHtmlInput`, `ScrapeMarkdownInput`, `GetScreenshotInput`,
`ScrapeBrandInput`, `ScrapeJsonInput`, `WebSearchInput`), and the response
types `MrScraperResponse`, `PageData`, `WebSearchResponse`, and
`WebSearchResult`.

### Data and permissions

The tools send target URLs, search queries, and request options to MrScraper's
API. Page results are saved to your MrScraper dashboard. Use the tools only for
public or otherwise authorized content, and follow the target site's terms.
See the [Privacy Policy](https://mrscraper.com/privacy-policy) and
[Acceptable Use Policy](https://mrscraper.com/acceptable-use-policy).

### Links

- Documentation: https://docs.mrscraper.com/docs/integrations/vercel-ai-sdk
- MrScraper MCP server (for MCP clients): https://github.com/mrscraper-com/mrscraper-mcp
- Support: support@mrscraper.com

## Migration

Upgrading from 0.3:

- Removed inputs: `super`, `proxy`, `proxyCountry`, `waitUntil`,
  `returnCookie`, and `saveResult` on the page tools, `html` on
  `scrapeMarkdown`, and `html` and `markdown` on `getScreenshot`. A tool call
  that still sets one is rejected.
- Inputs without a default are no longer filled in: `timeout`, `geoCode`,
  `browserRendering`, `warmStart`, `blockResources`, `prompt`, `country`, and
  `numResults` are sent only when set. Leaving `browserRendering` out lets the
  API switch to a browser when a page blocks the first attempt.
- Every page request sends `saveResult=true` and `maxAge=0` unless `maxAge` is
  set. `timeout` now accepts up to 330 seconds.
- `scrapeHtml` takes `screenshot`; `getScreenshot` also takes custom viewport
  sizes such as `1280x800`; `scrapeJson` takes `waitForSelector`,
  `warmStart`, and `blockResources`, and includes the page HTML by default.
- `scrapeMarkdown` always returns Markdown text and `getScreenshot` returns only
  the screenshot.
- The package no longer depends on `@mrscraper/sdk`. Import `MrScraperError`
  and the response types from `@mrscraper/ai-sdk`.

Upgrading from 0.2: see the 0.3.0 entry in [CHANGELOG.md](CHANGELOG.md).

## Development and testing

The automated suite stubs `fetch` and makes no API calls.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## License

[MIT](LICENSE)
