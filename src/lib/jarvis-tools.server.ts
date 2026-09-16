const imageStore = new Map<string, { bytes: Uint8Array; contentType: string }>();

const SELF_REPO = "danielcech933-hue/your-personal-jarvis";
const SELF_DEFAULT_BRANCH = "main";
const ALLOWED_SELF_PREFIXES = ["src/", "public/", "docs/"];

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
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export async function webSearch(query: string) {
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,application/xhtml+xml" } });
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
  while ((m = snippetRe.exec(html)) && snippets.length < 6) snippets.push(stripHtml(m[1] ?? "").slice(0, 300));
  const results = links.map((link, i) => ({ ...link, snippet: snippets[i] ?? "" }));
  return results.length ? { results } : { error: "Vyhledávání nevrátilo žádné výsledky.", results };
}

export async function readPage(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,application/xhtml+xml" } });
  if (!res.ok) return { error: `Could not open page (status ${res.status})` };
  const html = await res.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  return { url, title: stripHtml(title), text: stripHtml(html).slice(0, 12000) };
}

function githubToken() {
  return process.env["GITHUB_TOKEN"] || process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || "";
}

function githubHeaders() {
  const token = githubToken();
  if (!token) throw new Error("GITHUB_TOKEN není nastavený v serverových secrets.");
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
}

function assertSelfPath(path: string) {
  const clean = path.replace(/^\/+/, "");
  if (!ALLOWED_SELF_PREFIXES.some((prefix) => clean.startsWith(prefix))) throw new Error("Tento soubor není v povoleném vývojovém prostoru JARVIS.");
  return clean;
}

async function githubApi(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...githubHeaders(), ...(init?.headers || {}) } });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${data?.message || text || "unknown error"}`);
  return data;
}

export async function githubReadSelfFile(path: string, ref = SELF_DEFAULT_BRANCH) {
  const clean = assertSelfPath(path);
  const data = await githubApi(`/repos/${SELF_REPO}/contents/${clean}?ref=${encodeURIComponent(ref)}`);
  const content = typeof data?.content === "string" ? atob(data.content.replace(/\n/g, "")) : "";
  return { repository: SELF_REPO, path: clean, ref, sha: data?.sha, content };
}

export async function githubListSelfFiles(path = "src", ref = SELF_DEFAULT_BRANCH) {
  const clean = assertSelfPath(`${path.replace(/\/$/, "")}/index.ts`.includes("index.ts") && path ? path : path);
  const data = await githubApi(`/repos/${SELF_REPO}/contents/${encodeURIComponent(clean)}?ref=${encodeURIComponent(ref)}`);
  const entries = Array.isArray(data) ? data : [data];
  return { repository: SELF_REPO, path: clean, ref, entries: entries.map((entry: any) => ({ name: entry.name, path: entry.path, type: entry.type, sha: entry.sha })) };
}

export async function githubSearchSelfCode(query: string) {
  const q = `${query} repo:${SELF_REPO}`;
  const data = await githubApi(`/search/code?q=${encodeURIComponent(q)}&per_page=10`);
  return { query, results: (data?.items || []).map((item: any) => ({ name: item.name, path: item.path, sha: item.sha, url: item.html_url })) };
}

export async function githubCreateSelfBranch(branch: string, fromRef = SELF_DEFAULT_BRANCH) {
  const safeBranch = branch.replace(/[^a-zA-Z0-9._/-]/g, "-").slice(0, 80);
  if (!safeBranch || safeBranch === SELF_DEFAULT_BRANCH) throw new Error("Neplatný název vývojové větve.");
  const refData = await githubApi(`/repos/${SELF_REPO}/git/ref/heads/${encodeURIComponent(fromRef)}`);
  await githubApi(`/repos/${SELF_REPO}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${safeBranch}`, sha: refData.object.sha }) });
  return { repository: SELF_REPO, branch: safeBranch, fromRef, baseSha: refData.object.sha };
}

export async function githubWriteSelfFile(path: string, content: string, branch: string, message: string) {
  const clean = assertSelfPath(path);
  if (!branch || branch === SELF_DEFAULT_BRANCH) throw new Error("JARVIS zapisuje změny nejdřív do vlastní vývojové větve, ne přímo do main.");
  const existing = await githubApi(`/repos/${SELF_REPO}/contents/${clean}?ref=${encodeURIComponent(branch)}`).catch((error) => {
    if (String(error).includes("GitHub API 404")) return null;
    throw error;
  });
  const body: Record<string, unknown> = { message: message.slice(0, 140), content: btoa(unescape(encodeURIComponent(content))), branch };
  if (existing?.sha) body.sha = existing.sha;
  const data = await githubApi(`/repos/${SELF_REPO}/contents/${clean}`, { method: "PUT", body: JSON.stringify(body) });
  return { repository: SELF_REPO, path: clean, branch, commitSha: data?.commit?.sha, contentSha: data?.content?.sha };
}

export async function githubCreateSelfPullRequest(branch: string, title: string, body: string) {
  if (!branch || branch === SELF_DEFAULT_BRANCH) throw new Error("Pull request musí vycházet z vývojové větve.");
  const data = await githubApi(`/repos/${SELF_REPO}/pulls`, { method: "POST", body: JSON.stringify({ title: title.slice(0, 120), head: branch, base: SELF_DEFAULT_BRANCH, body: body.slice(0, 10000), draft: true }) });
  return { repository: SELF_REPO, number: data?.number, url: data?.html_url, branch, title: data?.title };
}

export async function generateImage(prompt: string, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "google/gemini-3-pro-image", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }) });
  if (!res.ok) return { error: `Image generation failed (${res.status}): ${await res.text().catch(() => "")}` };
  const data = await res.json() as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
  const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) return { error: "The model returned no image." };
  const commaAt = dataUrl.indexOf(",");
  const contentType = dataUrl.slice(5, commaAt).split(";")[0] || "image/png";
  const binary = atob(dataUrl.slice(commaAt + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const id = putImage(bytes, contentType);
  return { imageUrl: `/api/image/${id}`, prompt };
}
