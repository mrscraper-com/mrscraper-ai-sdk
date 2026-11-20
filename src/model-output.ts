import type { MrScraperResponse } from "@mrscraper/sdk";
import type { JSONValue, ToolResultPart } from "ai";

/**
 * Sends a base64 screenshot to the model as an image part instead of a string
 * inside JSON, which would cost hundreds of thousands of text tokens. Results
 * without a screenshot go to the model as JSON, as the AI SDK sends them by
 * default. The tool result itself keeps the screenshot.
 */
export function screenshotModelOutput({ output }: { output: MrScraperResponse }): ToolResultPart["output"] {
  const { data } = output;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const { screenshot, ...rest } = data as Record<string, unknown>;
    if (typeof screenshot === "string" && screenshot !== "") {
      return {
        type: "content",
        value: [
          { type: "text", text: JSON.stringify({ ...output, data: rest }) },
          { type: "file", mediaType: "image", data: { type: "data", data: screenshot } },
        ],
      };
    }
  }
  return { type: "json", value: JSON.parse(JSON.stringify(output)) as JSONValue };
}
