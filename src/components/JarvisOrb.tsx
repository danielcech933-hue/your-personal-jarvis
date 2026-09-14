type Props = {
  state: "idle" | "listening" | "thinking" | "speaking";
  level: number;
};

const labels: Record<Props["state"], string> = {
  idle: "V pohotovosti",
  listening: "Poslouchám",
  thinking: "Přemýšlím",
  speaking: "Mluvím",
};

export function JarvisOrb({ state, level }: Props) {
  const scale = 1 + (state === "speaking" ? level * 0.22 : state === "listening" ? 0.05 : 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44 sm:h-56 sm:w-56">
        <div className="jarvis-ring-a absolute inset-0 rounded-full border border-dashed border-primary/40" />
        <div className="jarvis-ring-b absolute inset-4 rounded-full border border-accent/30" />
        <div
          className="absolute inset-8 rounded-full bg-primary/15 jarvis-glow transition-transform duration-150"
          style={{ transform: `scale(${scale})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold tracking-[0.35em] text-primary sm:text-3xl">
            J.A.R.V.I.S
          </span>
        </div>
      </div>
      <p className="jarvis-label">
        {labels[state]}
        {state === "thinking" ? "…" : ""}
      </p>
    </div>
  );
}
