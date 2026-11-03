/** Page formats the scraperAPI tool can return. */
export type PageFormat = "markdown" | "html" | "screenshot";

/** What the scraperAPI tool returns for one page. */
export interface PageResult {
  url: string;
  /** HTTP status of the MrScraper API response, not of the target page. */
  statusCode: number;
  markdown?: string;
  html?: string;
  /**
   * Base64-encoded image (PNG or JPEG, depending on the page). Sent to the
   * model as an image, not as text.
   */
  screenshot?: string;
  /** MrScraper tokens this request used, when the API reports it. */
  tokenUsage?: number;
  /** Error the API reported alongside a successful response. */
  error?: string;
}

/** One web search result. */
export interface SearchResultItem {
  rank?: number;
  title?: string;
  link?: string;
  description?: string;
  source?: string;
}

/** What the webSearch tool returns. */
export interface SearchResult {
  query: string;
  results: SearchResultItem[];
}

interface ApiResponse {
  status_code: number;
  data: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Keeps the requested formats the API returned, plus usage and errors.
 *
 * When only HTML is requested, the API proxies the page and answers with the
 * raw HTML string instead of a JSON object; that string is the html format.
 */
export function toPageResult(
  url: string,
  formats: readonly PageFormat[],
  response: ApiResponse,
): PageResult {
  const result: PageResult = { url, statusCode: response.status_code };
  if (typeof response.data === "string") {
    const html = text(response.data);
    if (html !== undefined && formats.includes("html")) result.html = html;
    return result;
  }
  const data = record(response.data);
  for (const format of formats) {
    const content = text(data[format]);
    if (content !== undefined) result[format] = content;
  }
  const tokenUsage = number(data.token_usage);
  if (tokenUsage !== undefined) result.tokenUsage = tokenUsage;
  const error = data.error;
  if (error !== null && error !== undefined && error !== "") {
    result.error = typeof error === "string" ? error : JSON.stringify(error);
  }
  return result;
}

/** Reduces the search response to what a model needs to choose pages. */
export function toSearchResult(query: string, response: ApiResponse): SearchResult {
  const items = record(response.data).data;
  return {
    query,
    results: (Array.isArray(items) ? items : []).map((entry) => {
      const item = record(entry);
      return {
        rank: number(item.rank),
        title: text(item.title),
        link: text(item.url),
        description: text(item.description),
        source: text(item.source),
      };
    }),
  };
}

type ModelOutput =
  | { type: "json"; value: { [key: string]: string | number | undefined } }
  | {
      type: "content";
      value: Array<
        | { type: "text"; text: string }
        | {
            type: "file";
            mediaType: string;
            data: { type: "data"; data: string };
          }
      >;
    };

/**
 * Sends a screenshot to the model as an image part instead of a base64 string
 * inside JSON, which would cost hundreds of thousands of text tokens.
 */
export function toPageModelOutput(output: PageResult): ModelOutput {
  const { screenshot, ...rest } = output;
  if (screenshot === undefined) return { type: "json", value: { ...rest } };
  return {
    type: "content",
    value: [
      { type: "text", text: JSON.stringify(rest) },
      {
        type: "file",
        mediaType: "image",
        data: { type: "data", data: screenshot },
      },
    ],
  };
}
