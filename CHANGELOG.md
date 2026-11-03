# Changelog

All notable changes to `@mrscraper/ai-sdk` are documented here. The project
follows [Semantic Versioning](https://semver.org/).

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
