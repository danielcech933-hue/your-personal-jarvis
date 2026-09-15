import { useEffect, useRef, useState } from "react";
import idleImg from "@/assets/chibi-idle.png";
import talkImg from "@/assets/chibi-talk.png";
import sleepImg from "@/assets/chibi-sleep.png";
import boredImg from "@/assets/chibi-bored.png";
import playImg from "@/assets/chibi-play.png";
import curiousImg from "@/assets/chibi-curious.png";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export type AvatarMood = "normal" | "bored" | "play" | "sleep" | "curious";

type Props = {
  state: AvatarState;
  mood: AvatarMood;
  level: number;
};

const labels: Record<AvatarState, string> = {
  idle: "V pohotovosti",
  listening: "Poslouchám",
  thinking: "Přemýšlím",
  speaking: "Mluvím",
};

const moodLabels: Record<AvatarMood, string> = {
  normal: "",
  bored: "Trochu se nudí",
  play: "Hraje si",
  sleep: "Podřimuje",
  curious: "Je zvědavá",
};

function moodImage(mood: AvatarMood) {
  if (mood === "sleep") return sleepImg;
  if (mood === "bored") return boredImg;
  if (mood === "play") return playImg;
  if (mood === "curious") return curiousImg;
  return idleImg;
}

export function JarvisAvatar({ state, mood, level }: Props) {
  const [mouthOpen, setMouthOpen] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Mouth sync while speaking.
  useEffect(() => {
    if (state !== "speaking") {
      setMouthOpen(false);
      return;
    }
    const id = setInterval(() => {
      setMouthOpen((prev) => (level > 0.08 ? !prev : false));
    }, 120);
    return () => clearInterval(id);
  }, [state, level]);

  // Head follows the pointer -> depth illusion.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const node = wrapRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
      const dy = (event.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
      setTilt({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Random blinking, except while asleep.
  useEffect(() => {
    if (mood === "sleep") {
      setBlink(false);
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const loop = () => {
      timeout = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => setBlink(false), 130);
          loop();
        },
        2200 + Math.random() * 4200,
      );
    };
    loop();
    return () => clearTimeout(timeout);
  }, [mood]);

  const asleep = mood === "sleep";
  const base = moodImage(mood);
  const front = state === "speaking" && mouthOpen ? talkImg : base;
  const speakScale = state === "speaking" ? 1 + Math.min(level, 1) * 0.05 : 1;

  const rotY = tilt.x * (asleep ? 4 : 12);
  const rotX = -tilt.y * (asleep ? 3 : 8);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={wrapRef}
        className="relative h-64 w-64 sm:h-72 sm:w-72"
        style={{ perspective: "900px" }}
      >
        <div className="jarvis-ring-a absolute inset-0 rounded-full border border-dashed border-primary/30" />
        <div className="jarvis-ring-b absolute inset-4 rounded-full border border-accent/25" />
        <div
          className="jarvis-glow absolute inset-8 rounded-full bg-primary/10 transition-transform duration-300"
          style={{
            transform: `scale(${1 + (state === "listening" ? 0.08 : 0) + level * 0.15})`,
          }}
        />

        <div
          className={`absolute inset-0 ${asleep ? "jarvis-float-slow" : "jarvis-float"}`}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-2 transition-transform duration-300 ease-out"
            style={{
              transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) translateZ(30px) scale(${speakScale})`,
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className={`relative h-full w-full overflow-hidden rounded-full ${
                state === "thinking" ? "jarvis-think" : ""
              } ${mood === "play" ? "jarvis-bounce" : ""}`}
            >
              <img
                src={front}
                alt="Chibi podoba Jarvise"
                width={1024}
                height={1024}
                className="absolute inset-0 h-full w-full object-cover object-top"
                style={{
                  transform: `scaleY(${blink ? 0.965 : 1})`,
                  transformOrigin: "50% 40%",
                  transition: "transform 90ms ease-out",
                }}
              />
              {blink && !asleep && (
                <div className="absolute inset-0 bg-background/10" aria-hidden />
              )}
            </div>
          </div>
        </div>

        {/* ground shadow for depth */}
        <div className="pointer-events-none absolute -bottom-2 left-1/2 h-4 w-32 -translate-x-1/2 rounded-[50%] bg-primary/20 blur-md" />
      </div>

      <p className="jarvis-label text-center">
        {labels[state]}
        {state === "thinking" ? "…" : ""}
        {moodLabels[mood] && state === "idle" ? ` · ${moodLabels[mood]}` : ""}
      </p>
    </div>
  );
}
