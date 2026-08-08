/**
 * POST /api/gemini/generate — the Gemini relay.
 *
 * The server half of `src/pc/lib/gemini.ts`, replacing the `/api/gemini/*`
 * route PC served from its Express host. It exists so the API key stays on
 * the server: every AI app in the roster calls this endpoint, and none of
 * them ever sees a credential.
 *
 * The key is optional. Without `GEMINI_API_KEY` the route answers 503 with a
 * plain explanation, which the client surfaces verbatim — so an AI app in an
 * unconfigured deployment says "not configured" rather than failing with a
 * generic error or, worse, appearing to work.
 */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Default model. Overridable per request so apps can pick their own. */
const DEFAULT_MODEL = "gemini-2.5-flash";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface RelayRequest {
  model?: string;
  contents?: unknown;
  config?: { tools?: unknown; systemInstruction?: unknown; [k: string]: unknown };
  tools?: unknown;
  systemInstruction?: unknown;
}

export const Route = createFileRoute("/api/gemini/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return json(
            {
              error:
                "Gemini is not configured on this deployment. Set GEMINI_API_KEY on the server to enable the AI apps.",
            },
            503,
          );
        }

        let body: RelayRequest;
        try {
          body = (await request.json()) as RelayRequest;
        } catch {
          return json({ error: "Request body was not valid JSON." }, 400);
        }

        const model = typeof body.model === "string" && body.model ? body.model : DEFAULT_MODEL;

        // PC's callers pass tools/systemInstruction either at the top level or
        // nested under `config`. Accept both rather than making every ported
        // app rewrite its call site.
        const tools = body.config?.tools ?? body.tools;
        const systemInstruction = body.config?.systemInstruction ?? body.systemInstruction;

        const upstreamBody: Record<string, unknown> = { contents: body.contents };
        if (tools) upstreamBody.tools = tools;
        if (systemInstruction) upstreamBody.systemInstruction = systemInstruction;

        let upstream: Response;
        try {
          upstream = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              // Header rather than a query string: a key in the URL ends up in
              // proxy and access logs.
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(upstreamBody),
          });
        } catch (err) {
          return json(
            {
              error: `Could not reach Gemini: ${err instanceof Error ? err.message : "network error"}`,
            },
            502,
          );
        }

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          // Pass the status through so a quota error reads as a quota error,
          // but never echo the raw upstream body — it can restate the key.
          return json(
            {
              error: `Gemini returned ${upstream.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
            },
            upstream.status === 429 ? 429 : 502,
          );
        }

        const data = (await upstream.json()) as {
          candidates?: {
            content?: {
              parts?: { text?: string; functionCall?: { name: string; args: unknown } }[];
            };
          }[];
        };

        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const text = parts
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        const functionCalls = parts
          .filter((p) => p.functionCall)
          .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args }));

        // Shape matches what `getAiClient()` expects, so the ported apps read
        // `.text` and `.functionCalls` exactly as they did against PC's relay.
        return json({ response: text, functionCalls });
      },
    },
  },
});
