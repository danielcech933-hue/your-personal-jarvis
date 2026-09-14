import { createFileRoute } from "@tanstack/react-router";
import { getImage } from "@/lib/jarvis-tools.server";

export const Route = createFileRoute("/api/image/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const image = getImage(params.id);
        if (!image) return new Response("Not found", { status: 404 });
        return new Response(image.bytes as unknown as BodyInit, {
          headers: {
            "Content-Type": image.contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
