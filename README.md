# MrScraper tools for the AI SDK

[MrScraper](https://mrscraper.com) tools for the [Vercel AI SDK](https://ai-sdk.dev):
retrieve public web pages as Markdown, HTML, or screenshots, search the web, and
check your MrScraper plan and token usage.

## Install

```bash
npm install @mrscraper/ai-sdk ai zod
```

Requires AI SDK 7 and Node.js 18 or later. Get an API key at
[app.mrscraper.com/api-tokens](https://app.mrscraper.com/api-tokens) and set it
as `MRSCRAPER_API_KEY` (or pass `apiKey` to the tool factories).

## Use

```ts
import { generateText, isStepCount } from "ai";
import { mrscraperTools } from "@mrscraper/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5",
  prompt:
    "Read https://www.scrapethissite.com/pages/simple/ and list the five countries with the largest area.",
  tools: mrscraperTools(),
  stopWhen: isStepCount(5),
});

console.log(text);
```

Pick individual tools when you only need some of them:

```ts
import { scraperApiTool, webSearchTool } from "@mrscraper/ai-sdk";

const tools = {
  scraperAPI: scraperApiTool({ apiKey: process.env.MRSCRAPER_API_KEY }),
  webSearch: webSearchTool(),
};
```

## Tools

| Tool | Factory | What it does |
| --- | --- | --- |
| `scraperAPI` | `scraperApiTool()` | Retrieves a known public page as Markdown (default), HTML, a screenshot, or a combination. Renders JavaScript-heavy pages in a browser when needed. Inputs: `url`, `formats`, `browserRendering`, `waitForSelector`, `geoCode`, `timeout`. |
| `webSearch` | `webSearchTool()` | Searches the web and returns parsed organic results (`rank`, `title`, `link`, `description`, `source`), "People also ask" entries, and the next page number. Inputs: `query` (text or a search results URL), `region`, `language`, `page`. |
| `status` | `accountStatusTool()` | Returns the subscription status, token limit, tokens used, and tokens remaining. Uses no tokens. |

`scraperAPI` sends screenshots to the model as image parts instead of base64
text, so a screenshot costs image tokens rather than hundreds of thousands of
text tokens. Other results are sent as JSON.

`scraperAPI` and `webSearch` use tokens from your MrScraper plan. Errors from
the API (for example an invalid key) are thrown from the tool and reported to
the model as tool errors; the key never appears in the error.

## Data and permissions

The tools send target URLs, search queries, and request options to MrScraper's
API. Use them only for public or otherwise authorized content, and follow the
target site's terms. See the [Privacy Policy](https://mrscraper.com/privacy-policy)
and [Acceptable Use Policy](https://mrscraper.com/acceptable-use-policy).

## Links

- Documentation: https://docs.mrscraper.com/docs/integrations/vercel-ai-sdk
- MrScraper MCP server (for MCP clients): https://github.com/mrscraper-com/mrscraper-mcp
- Support: support@mrscraper.com

## License

[MIT](LICENSE)
