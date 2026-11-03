import { MrScraperError } from "@mrscraper/sdk";

/** MrScraper's web search runs as the "websearch" action on the Scraper API host. */
export const WEB_SEARCH_ENDPOINT = "https://api.mrscraper.com";

export interface WebSearchRequest {
  query: string;
  /** Two-letter country code; the API defaults to us. */
  country?: string;
  /** 10 to 100; the API defaults to 10. */
  numResults?: number;
}

export interface WebSearchResponse {
  status_code: number;
  data: unknown;
}

/** Returns the query text, or the q parameter of a search results URL. */
export function searchQuery(input: string): string {
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) return value;
  const query = new URL(value).searchParams.get("q")?.trim();
  if (!query) throw new TypeError("Search results URL must contain a q parameter");
  return query;
}

/**
 * Runs one web search. Errors match `@mrscraper/sdk`: a missing key, a 401,
 * any other non-2xx response, and network failures throw `MrScraperError`
 * with the key redacted.
 */
export async function webSearch(
  apiKey: string | undefined,
  { query, country, numResults }: WebSearchRequest,
  timeoutSeconds = 600,
): Promise<WebSearchResponse> {
  const token = apiKey || process.env.MRSCRAPER_API_TOKEN || "";
  if (!token.trim()) {
    throw new MrScraperError(
      "API key is not set. Pass apiKey or set MRSCRAPER_API_KEY. Get your key at https://app.mrscraper.com/api-tokens.",
    );
  }
  try {
    const response = await fetch(WEB_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${token}`,
        "x-api-token": token,
      },
      body: JSON.stringify({
        action: "websearch",
        query,
        ...(country ? { country: country.toLowerCase() } : {}),
        ...(numResults ? { numResults } : {}),
      }),
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
    });
    if (response.status === 401) {
      throw new MrScraperError(
        "Unauthorized or invalid token. Please go to https://app.mrscraper.com to get your token.",
        401,
      );
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const data: unknown = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      throw new MrScraperError(message.replaceAll(token, "[REDACTED]"), response.status);
    }
    return { status_code: response.status, data };
  } catch (error) {
    if (error instanceof MrScraperError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new MrScraperError(message.replaceAll(token, "[REDACTED]"));
  }
}
