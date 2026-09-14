import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text } = (await request.json()) as { text?: string };
        if (!text?.trim()) return new Response("Text is required", { status: 400 });
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text.slice(0, 4000),
              voice: "onyx",
              instructions:
                "Speak as a calm, refined British AI butler. Confident, warm, slightly witty, unhurried but efficient.",
              stream_format: "sse",
              response_format: "pcm",
            }),
            signal: request.signal,
          });
          if (!response.ok) {
            const detail = await response.text().catch(() => "");
            return new Response(detail || "TTS failed", { status: response.status });
          }
          return new Response(response.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw error;
        }
      },
    },
  },
});
