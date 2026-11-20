# Changelog

All notable changes to `@mrscraper/ai-sdk` are documented here. The project
follows [Semantic Versioning](https://semver.org/).

## 0.3.0 - 2026-11-20

- The tools follow the MrScraper Integrations Standard, which MrScraper MCP
  server 0.5.0 also uses. `mrscraperTools()` returns seven tools under the
  Node SDK and MCP names: `status`, `scrapeHtml`, `scrapeMarkdown`,
  `getScreenshot`, `scrapeBrand`, `scrapeJson`, and `webSearch`. Tool
  descriptions and input names, defaults, and descriptions are the standard
  ones. Inputs a tool does not define are rejected.
- Built on `@mrscraper/sdk` 6 (was 5). Every tool sends a `GET`; `scrapeJson`
  switches to `POST` when the encoded URL exceeds 8,000 characters.
- `scraperAPI` (`scraperApiTool()`) is removed. Use `scrapeHtml`,
  `scrapeMarkdown`, or `getScreenshot`. Browser rendering is off unless
  `browserRendering` is true (screenshots always render), and the page
  timeout defaults to 300 seconds (was 120).
- New tools: `scrapeBrand` (`scrapeBrandTool()`) and `scrapeJson`
  (`scrapeJsonTool()`).
- `webSearch` takes `query`, `country`, and `numResults`. `region` is removed,
  and a search results URL is no longer read for its `q` parameter. The tool
  calls the SDK's `webSearch` instead of posting to the endpoint itself.
- `status` (`statusTool()`, was `accountStatusTool()`) returns the raw account
  status API response instead of a usage summary.
- Every tool returns the SDK's response envelope, `{ status_code, data,
  headers }`, with the API response body in `data`. The `PageResult`,
  `PageFormat`, `SearchResult`, `SearchResultItem`, `ScraperApiInput`, and
  `AccountSummary` types are removed. Each tool has an input type, such as
  `ScrapeHtmlInput`, and `MrScraperResponse`, `PageData`, `WebSearchResponse`,
  and `WebSearchResult` are re-exported from the SDK.
- Screenshots from `getScreenshot`, and from `scrapeJson` when requested,
  still reach the model as image parts.

## 0.2.1 - 2026-11-16

- `scraperAPI` now loads pages with `GET`. It uses `@mrscraper/sdk` 5, whose
  `scraper_api` puts the page URL and retry options in the query string and
  sends no body. 0.2.0 used `@mrscraper/sdk` 3.1, which sent a POST with a
  JSON body. The Scraper API passes a request body on to the target site, so
  sites received a POST, and many refused it.
- Tool names, inputs, and outputs are unchanged.

## 0.2.0 - 2026-11-02

- `webSearch` now calls MrScraper's new web search endpoint (the `websearch`
  action on `https://api.mrscraper.com`) instead of the SDK's `web_search`.
  Errors are still `MrScraperError` with the key redacted.
- Inputs: `query`, `region` (two-letter country, default `us`), and the new
  `numResults` (10 to 100, default 10). `language` and `page` are removed
  because the new endpoint doesn't support them.
- Output: `{ query, results }`, each result with `rank`, `title`, `link`,
  `description`, and `source`. `peopleAlsoAsk` and `nextPage` are removed for
  the same reason.

## 0.1.1 - 2026-10-29

- Reworded search as web search in the package description, keywords,
  README, tool description, and type comments. Tool names, inputs, and outputs
  are unchanged.

## 0.1.0 - 2026-10-22

- Initial release: `scraperAPI`, `webSearch`, and `status` tools for AI SDK 7,
  built on `@mrscraper/sdk`. Screenshots reach the model as image parts.
