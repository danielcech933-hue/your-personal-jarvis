const OWNER = process.env["JARVIS_GITHUB_OWNER"] || "danielcech933-hue";
const REPO = process.env["JARVIS_GITHUB_REPO"] || "your-personal-jarvis";
const DEFAULT_BRANCH = process.env["JARVIS_GITHUB_BASE_BRANCH"] || "main";
const API = "https://api.github.com";

type GithubFile = { path: string; sha: string; content?: string };

type GithubResponse<T> = { status: number; data: T };

function token() {
  const value = process.env["JARVIS_GITHUB_TOKEN"] || process.env["GITHUB_TOKEN"];
  if (!value) throw new Error("GitHub self-editing is not configured: missing JARVIS_GITHUB_TOKEN.");
  return value;
}

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function safePath(path: string) {
  const value = path.replace(/^\/+/, "").trim();
  if (!value || value.includes("..") || value.startsWith(".git/")) throw new Error("Invalid repository path.");
  const allowed = /^(src|public|docs)\/[A-Za-z0-9._@+\-\/]+$/;
  if (!allowed.test(value)) throw new Error("Self-editing is limited to src/, public/, and docs/.");
  return value;
}

async function gh<T>(url: string, init?: RequestInit): Promise<GithubResponse<T>> {
  const response = await fetch(`${API}${url}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) } });
  const text = await response.text();
  let data: T;
  try { data = JSON.parse(text) as T; } catch { data = text as T; }
  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data ? String((data as { message?: unknown }).message) : `GitHub API ${response.status}`;
    throw new Error(message);
  }
  return { status: response.status, data };
}

export async function readRepositoryFile(path: string, ref = DEFAULT_BRANCH) {
  const safe = safePath(path);
  const { data } = await gh<{ type: string; path: string; sha: string; content?: string; encoding?: string }>(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(safe).replace(/%2F/g, "/")}?ref=${encodeURIComponent(ref)}`);
  if (data.type !== "file" || !data.content) throw new Error("Path is not a readable UTF-8 repository file.");
  const content = Buffer.from(data.content.replace(/\n/g, ""), data.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  return { path: safe, sha: data.sha, content, ref };
}

export async function ensureSelfEditBranch(branch = "jarvis/self-edit") {
  const safeBranch = branch.replace(/[^A-Za-z0-9._\/-]/g, "-").slice(0, 120) || "jarvis/self-edit";
  try {
    await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${encodeURIComponent(safeBranch).replace(/%2F/g, "/")}`);
  } catch {
    const { data: base } = await gh<{ object: { sha: string } }>(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(DEFAULT_BRANCH)}`);
    await gh(`/repos/${OWNER}/${REPO}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${safeBranch}`, sha: base.object.sha }) });
  }
  return safeBranch;
}

export async function updateRepositoryFile(path: string, content: string, message: string, branch = "jarvis/self-edit") {
  const safe = safePath(path);
  const editBranch = await ensureSelfEditBranch(branch);
  let existing: GithubFile | null = null;
  try { existing = await readRepositoryFile(safe, editBranch); } catch { existing = null; }
  const body: Record<string, unknown> = {
    message: message.trim() || `Jarvis self-edit: update ${safe}`,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: editBranch,
  };
  if (existing?.sha) body.sha = existing.sha;
  const { data } = await gh<{ commit?: { sha?: string; html_url?: string }; content?: { sha?: string } }>(`/repos/${OWNER}/${REPO}/contents/${safe}`, { method: existing ? "PUT" : "PUT", body: JSON.stringify(body) });
  return { path: safe, branch: editBranch, commitSha: data.commit?.sha || null, commitUrl: data.commit?.html_url || null, contentSha: data.content?.sha || null };
}

export async function createSelfEditPr(title: string, body: string, branch = "jarvis/self-edit") {
  const editBranch = await ensureSelfEditBranch(branch);
  const { data } = await gh<{ number: number; html_url: string; state: string; title: string }>(`/repos/${OWNER}/${REPO}/pulls`, { method: "POST", body: JSON.stringify({ title, body, head: editBranch, base: DEFAULT_BRANCH, draft: true }) });
  return data;
}

export const githubSelfEditConfig = { owner: OWNER, repo: REPO, baseBranch: DEFAULT_BRANCH };
