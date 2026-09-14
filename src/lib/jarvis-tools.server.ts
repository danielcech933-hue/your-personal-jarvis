const imageStore = new Map<string, { bytes: Uint8Array; contentType: string }>();

export function putImage(bytes: Uint8Array, contentType: string) {
  const id = crypto.randomUUID();
  imageStore.set(id, { bytes, contentType });
  if (imageStore.size > 30) {
    const oldest = imageStore.keys().next().value;
    if (oldest) imageStore.delete(oldest);
  }
  return id;
}

export function getImage(id: string) {
  return imageStore.get(id);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webSearch(query: string) {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    body: new URLSearchParams({ q: query }).toString(),
  });
  if (!res.ok) return { error: `Search failed with status ${res.status}`, results: [] };
  const html = await res.text();
  const results: { title: string; url: string; snippet: string }[] = [];
  const blockRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|<\/div>\s*<\/div>\s*<\/div>)/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html)) && results.length < 6) {
    let url = match[1];
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    results.push({
      title: stripHtml(match[2]).slice(0, 200),
      url,
      snippet: stripHtml(match[3]).slice(0, 300),
    });
  }
  return { results };
}

export async function readPage(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return { error: `Could not open page (status ${res.status})` };
  const html = await res.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  return { url, title: stripHtml(title), text: stripHtml(html).slice(0, 12000) };
}

export async function generateImage(prompt: string, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    return { error: `Image generation failed (${res.status}): ${await res.text().catch(() => "")}` };
  }
  const data = (await res.json()) as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
  };
  const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) return { error: "The model returned no image." };
  const commaAt = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, commaAt);
  const contentType = meta.split(";")[0] || "image/png";
  const binary = atob(dataUrl.slice(commaAt + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const id = putImage(bytes, contentType);
  return { imageUrl: `/api/image/${id}`, prompt };
}
