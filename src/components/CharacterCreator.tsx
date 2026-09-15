import { Palette, Sparkles, UserRound, WandSparkles } from "lucide-react";
import type { JarvisAppearance } from "@/lib/jarvis-profile";

type Props = { appearance: JarvisAppearance; onChange: (appearance: JarvisAppearance) => void };

const options = {
  style: ["glamorous", "cyber", "casual"] as const,
  hair: ["silver", "black", "violet", "rose"] as const,
  outfit: ["midnight", "white", "crimson"] as const,
  accent: ["cyan", "violet", "rose"] as const,
  body: ["slim", "athletic", "curvy"] as const,
};

const labels: Record<string, string> = {
  glamorous: "Elegantní",
  cyber: "Cyber",
  casual: "Casual",
  silver: "Stříbrné",
  black: "Černé",
  violet: "Fialové",
  rose: "Růžové",
  midnight: "Půlnoční",
  white: "Bílé",
  crimson: "Crimson",
  cyan: "Cyan",
  violet: "Violet",
  rose: "Rose",
  slim: "Štíhlá",
  athletic: "Sportovní",
  curvy: "Výrazná",
};

function ChoiceRow<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[.2em] text-slate-500">{label}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {values.map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-lg border px-2 py-2 text-[11px] transition ${value === item ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/8 bg-white/[.02] text-slate-400 hover:border-white/20 hover:text-slate-200"}`}>
            {labels[item] || item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CharacterCreator({ appearance, onChange }: Props) {
  const update = <K extends keyof JarvisAppearance>(key: K, value: JarvisAppearance[K]) => onChange({ ...appearance, [key]: value });
  return (
    <div className="rounded-2xl border border-cyan-200/10 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100"><WandSparkles className="h-4 w-4 text-cyan-300" /> Tvoje postava</div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Dospělá anime společnice. Změny se propíšou do jejího vzhledu a uloží k tvému účtu.</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/5 text-cyan-200"><UserRound className="h-4 w-4" /></div>
      </div>

      <div className="mt-4 space-y-4">
        <ChoiceRow label="Styl" value={appearance.style} values={options.style} onChange={(v) => update("style", v)} />
        <ChoiceRow label="Vlasy" value={appearance.hair} values={options.hair} onChange={(v) => update("hair", v)} />
        <ChoiceRow label="Outfit" value={appearance.outfit} values={options.outfit} onChange={(v) => update("outfit", v)} />
        <ChoiceRow label="Akcent" value={appearance.accent} values={options.accent} onChange={(v) => update("accent", v)} />
        <ChoiceRow label="Postava" value={appearance.body} values={options.body} onChange={(v) => update("body", v)} />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[.2em] text-slate-500"><span>Výška</span><span className="text-cyan-200">{appearance.height.toFixed(2)}×</span></div>
          <input aria-label="Výška postavy" type="range" min="0.9" max="1.1" step="0.01" value={appearance.height} onChange={(event) => update("height", Number(event.target.value))} className="w-full accent-cyan-300" />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/[.02] px-3 py-2 text-[10px] text-slate-500"><Palette className="h-3.5 w-3.5 text-cyan-300" /> Každý účet má vlastní konfiguraci postavy.</div>
      </div>
    </div>
  );
}
