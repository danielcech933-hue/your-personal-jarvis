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
  const res = await fetch(
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    },
  );
  if (!res.ok) return { error: `Search failed with status ${res.status}`, results: [] };
  const html = await res.text();

  const links: { title: string; url: string }[] = [];
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && links.length < 6) {
    let url = (m[1] ?? "").replace(/&amp;/g, "&");
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg?.[1]) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    links.push({ title: stripHtml(m[2] ?? "").slice(0, 200), url });
  }

  const snippets: string[] = [];
  const snippetRe = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g;
  while ((m = snippetRe.exec(html)) && snippets.length < 6) {
    snippets.push(stripHtml(m[1] ?? "").slice(0, 300));
  }

  const results = links.map((link, i) => ({ ...link, snippet: snippets[i] ?? "" }));
  if (!results.length) return { error: "Vyhledávání nevrátilo žádné výsledky.", results };
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
