import { useEffect, useState } from "react";
import idleImg from "@/assets/chibi-idle.png";
import talkImg from "@/assets/chibi-talk.png";

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

export function JarvisAvatar({ state, level }: Props) {
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    if (state !== "speaking") {
      setMouthOpen(false);
      return;
    }
    const id = setInterval(() => {
      setMouthOpen((prev) => (level > 0.08 ? !prev : false));
    }, 130);
    return () => clearInterval(id);
  }, [state, level]);

  const scale = 1 + (state === "speaking" ? Math.min(level, 1) * 0.04 : 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-56 w-56 sm:h-64 sm:w-64">
        <div className="jarvis-ring-a absolute inset-0 rounded-full border border-dashed border-primary/40" />
        <div className="jarvis-ring-b absolute inset-3 rounded-full border border-accent/30" />
        <div
          className="jarvis-glow absolute inset-6 rounded-full bg-primary/10 transition-transform duration-200"
          style={{ transform: `scale(${1 + (state === "listening" ? 0.05 : 0) + level * 0.12})` }}
        />
        <div
          className={`absolute inset-2 overflow-hidden rounded-full transition-transform duration-150 ${
            state === "thinking" ? "animate-pulse" : ""
          }`}
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={idleImg}
            alt="Chibi podoba Jarvise"
            width={816}
            height={816}
            className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-75 ${
              mouthOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <img
            src={talkImg}
            alt=""
            aria-hidden
            width={816}
            height={816}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-75 ${
              mouthOpen ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      </div>
      <p className="jarvis-label">
        {labels[state]}
        {state === "thinking" ? "…" : ""}
      </p>
    </div>
  );
}
