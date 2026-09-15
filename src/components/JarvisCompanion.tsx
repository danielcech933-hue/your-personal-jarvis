import { useEffect, useMemo, useRef, useState } from "react";
import idleImg from "@/assets/chibi-idle.png";
import talkImg from "@/assets/chibi-talk.png";
import sleepImg from "@/assets/chibi-sleep.png";
import boredImg from "@/assets/chibi-bored.png";
import playImg from "@/assets/chibi-play.png";
import curiousImg from "@/assets/chibi-curious.png";
import type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";
export type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

type Props = { state: AvatarState; mood: AvatarMood; level: number; onAsk?: (question: string) => void };
type Point = { x: number; y: number };
const QUESTIONS = ["Na čem teď pracujeme?", "Mám ti s něčím pomoct?", "Nechceš zkusit něco nového?", "Máš dnes něco důležitého, na co nesmíme zapomenout?", "Mám se podívat, co je právě nového?"];
const imageForMood: Record<AvatarMood, string> = { normal: idleImg, bored: boredImg, play: playImg, sleep: sleepImg, curious: curiousImg };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function JarvisCompanion({ state, mood, level, onAsk }: Props) {
  const [position, setPosition] = useState<Point>({ x: 72, y: 72 });
  const [target, setTarget] = useState<Point>({ x: 72, y: 72 });
  const [pointer, setPointer] = useState<Point>({ x: 50, y: 45 });
  const [blink, setBlink] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lastInteraction = useRef(Date.now());
  const lastQuestion = useRef(0);
  const nextRoamAt = useRef(Date.now() + 5000);
  const velocity = useRef({ x: 0, y: 0 });

  const asleep = mood === "sleep";
  const image = state === "speaking" && mouthOpen ? talkImg : imageForMood[mood];
  const scale = useMemo(() => 0.94 + (state === "speaking" ? Math.min(level, 1) * 0.045 : 0), [level, state]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      setPointer({ x: (event.clientX / Math.max(window.innerWidth, 1)) * 100, y: (event.clientY / Math.max(window.innerHeight, 1)) * 100 });
      lastInteraction.current = Date.now();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dragging) return;
      const idleFor = Date.now() - lastInteraction.current;
      const roamDelay = asleep ? 12000 : idleFor > 25000 ? 5000 : 9000;
      if (Date.now() >= nextRoamAt.current) {
        const marginX = 12;
        const marginY = 14;
        setTarget({ x: marginX + Math.random() * (100 - marginX * 2), y: marginY + Math.random() * (100 - marginY * 2) });
        nextRoamAt.current = Date.now() + roamDelay + Math.random() * 7000;
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [asleep, dragging]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPosition((prev) => {
        if (dragging) return prev;
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.2) return prev;
        const speed = asleep ? 0.045 : mood === "play" ? 0.22 : mood === "bored" ? 0.09 : 0.13;
        velocity.current.x = velocity.current.x * 0.88 + (dx / Math.max(distance, 1)) * speed;
        velocity.current.y = velocity.current.y * 0.88 + (dy / Math.max(distance, 1)) * speed;
        return { x: clamp(prev.x + velocity.current.x, 8, 92), y: clamp(prev.y + velocity.current.y, 10, 88) };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [asleep, dragging, mood, target]);

  useEffect(() => {
    if (asleep) { setBlink(false); return; }
    let active = true;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!active) return;
        setBlink(true);
        window.setTimeout(() => active && setBlink(false), 120);
        schedule();
      }, 2200 + Math.random() * 4200);
    };
    schedule();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [asleep]);

  useEffect(() => {
    if (state !== "speaking") { setMouthOpen(false); return; }
    const timer = window.setInterval(() => setMouthOpen((open) => !open), 110);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastInteraction.current;
      const canAsk = idleFor > 28000 && Date.now() - lastQuestion.current > 90000 && !dragging;
      if (canAsk && onAsk) {
        lastQuestion.current = Date.now();
        lastInteraction.current = Date.now();
        setTarget({ x: 52 + Math.random() * 24, y: 56 + Math.random() * 18 });
        onAsk(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [dragging, onAsk]);

  const headX = clamp((pointer.x - position.x) * 0.22, -7, 7);
  const headY = clamp((pointer.y - position.y) * 0.12, -5, 5);
  const tilt = clamp(velocity.current.x * 8 + headX * 0.35, -5.5, 5.5);

  return (
    <div
      className="jarvis-companion-layer"
      aria-label="Živý Jarvis"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onPointerDown={(event) => {
        event.stopPropagation();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        setDragging(true);
        lastInteraction.current = Date.now();
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        setPosition({ x: clamp((event.clientX / Math.max(window.innerWidth, 1)) * 100, 8, 92), y: clamp((event.clientY / Math.max(window.innerHeight, 1)) * 100, 10, 88) });
      }}
      onPointerUp={(event) => {
        setDragging(false);
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        lastInteraction.current = Date.now();
        nextRoamAt.current = Date.now() + 4000;
      }}
    >
      <div className={`jarvis-companion ${asleep ? "jarvis-companion-sleeping" : ""} ${mood === "play" ? "jarvis-companion-playing" : ""}`}>
        <div className="jarvis-companion-aura" aria-hidden="true" />
        <div className="jarvis-companion-body" style={{ transform: `rotateY(${headX}deg) rotateX(${-headY}deg) rotateZ(${tilt}deg) scale(${scale})` }}>
          <img src={image} alt="" draggable={false} className="jarvis-companion-image" style={{ transform: `scaleY(${blink ? 0.965 : 1})` }} />
          {!asleep && <span className="jarvis-companion-shadow" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}
