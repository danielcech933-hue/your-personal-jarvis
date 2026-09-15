import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Sparkles, WandSparkles } from "lucide-react";
import { DEFAULT_PROFILE, saveJarvisProfile, type JarvisProfile } from "@/lib/jarvis-profile";
import { ensureSession, loadPrivateMemories, loadPrivateProfile, signIn, signOut, signUp, type AuthSession, savePrivateProfile } from "@/lib/supabase-rest";

type Props = { children: React.ReactNode };
const starterAppearance = { style: "glamorous", hair: "silver", outfit: "midnight", accent: "cyan", height: 1, body: "athletic" };

export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [characterName, setCharacterName] = useState("Nova");
  const [appearance, setAppearance] = useState(starterAppearance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const current = await ensureSession();
      if (current) {
        try {
          const remote = await loadPrivateProfile(current);
          const memories = await loadPrivateMemories(current);
          const profile: JarvisProfile = {
            ...DEFAULT_PROFILE,
            characterName: remote?.character_name || "Nova",
            userName: String(remote?.preferences?.userName || current.user.user_metadata?.userName || ""),
            favoriteTopics: Array.isArray(remote?.preferences?.favoriteTopics) ? remote.preferences.favoriteTopics : [],
            conversationStyle: (remote?.preferences?.conversationStyle || "friendly") as JarvisProfile["conversationStyle"],
            memories: memories.map((m) => ({ id: m.id, text: m.memory, createdAt: Date.parse(m.created_at) || Date.now() })),
            ...(remote?.appearance ? { appearance: remote.appearance } : {}),
          };
          saveJarvisProfile(profile);
        } catch {
          // Local profile remains usable if the profile table is temporarily unavailable.
        }
      }
      setSession(current);
      setReady(true);
    })();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      const current = mode === "login" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      if (!current?.access_token) {
        setNotice("Účet je vytvořený. Zkontroluj e-mail a potvrď registraci, potom se přihlas.");
        setMode("login");
        return;
      }
      const next: JarvisProfile = { ...DEFAULT_PROFILE, characterName: characterName.trim() || "Nova", userName: String(current.user?.user_metadata?.userName || ""), appearance };
      saveJarvisProfile(next);
      try { await savePrivateProfile(current, next); } catch { /* profile sync can retry later */ }
      setSession(current);
    } catch (err) { setError(err instanceof Error ? err.message : "Přihlášení se nepodařilo."); }
    finally { setBusy(false); }
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-[#050b12] text-cyan-100"><div className="text-sm tracking-[.22em] uppercase opacity-70">Probouzím JARVIS…</div></div>;
  if (session) return <>{children}</>;

  return <main className="min-h-screen bg-[#050b12] text-slate-100 flex items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 50% 35%, rgba(54,202,255,.16), transparent 38%), radial-gradient(circle at 15% 85%, rgba(101,63,192,.14), transparent 28%)" }} />
    <section className="relative w-full max-w-5xl grid gap-8 lg:grid-cols-[1fr_420px] items-center">
      <div className="hidden lg:block px-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1 text-[11px] uppercase tracking-[.24em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> Personal AI companion</div>
        <h1 className="mt-6 text-5xl font-semibold leading-tight">Než vstoupíš, <span className="text-cyan-300">vytvoř svou postavu.</span></h1>
        <p className="mt-5 max-w-lg text-slate-400 leading-7">Každý účet má vlastní soukromý profil, vlastní jméno, vzhled, paměť a osobnost. Tvoje data se čtou jen pod tvým přihlášeným účtem.</p>
      </div>
      <form onSubmit={submit} className="relative rounded-3xl border border-cyan-200/10 bg-slate-950/80 backdrop-blur-2xl p-7 shadow-2xl shadow-cyan-950/40">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><LockKeyhole className="h-5 w-5" /></div><div><div className="text-sm font-semibold">JARVIS</div><div className="text-xs text-slate-500">Soukromý účet</div></div></div>
        <div className="mt-6 flex rounded-xl border border-white/5 p-1 bg-white/[.02]"><button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-lg py-2 text-xs ${mode === "login" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}>Přihlásit</button><button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-lg py-2 text-xs ${mode === "signup" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}>Vytvořit účet</button></div>
        <div className="mt-5 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="E-mail" className="w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Heslo" className="w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
          {mode === "signup" && <>
            <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} required maxLength={32} placeholder="Jméno tvé postavy" className="w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 space-y-3"><div className="flex items-center gap-2 text-xs text-slate-300"><WandSparkles className="h-4 w-4 text-cyan-300" /> První vzhled</div><div className="grid grid-cols-2 gap-2">{["silver","black","violet","rose"].map((hair) => <button type="button" key={hair} onClick={() => setAppearance({ ...appearance, hair })} className={`rounded-lg border px-3 py-2 text-xs capitalize ${appearance.hair === hair ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-400"}`}>{hair}</button>)}</div><div className="grid grid-cols-3 gap-2">{["midnight","white","crimson"].map((outfit) => <button type="button" key={outfit} onClick={() => setAppearance({ ...appearance, outfit })} className={`rounded-lg border px-3 py-2 text-xs capitalize ${appearance.outfit === outfit ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-slate-400"}`}>{outfit}</button>)}</div><p className="text-[11px] leading-5 text-slate-500">Výchozí styl je elegantní a atraktivní dospělá anime postava. Vzhled se uloží k tvému účtu.</p></div>
          </>}
        </div>
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        {notice && <p className="mt-3 text-xs text-emerald-300">{notice}</p>}
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? "Pracuju…" : mode === "login" ? "Vstoupit" : "Vytvořit můj svět"}</button>
        {session && <button type="button" onClick={() => signOut().then(() => setSession(null))}>Odhlásit</button>}
      </form>
    </section>
  </main>;
}
