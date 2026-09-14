import { createParser } from "eventsource-parser";

export type SpeakHandle = { stop: () => void; done: Promise<void> };

/** Streams TTS audio from /api/speak and plays it as it arrives. */
export function speak(text: string, onLevel?: (level: number) => void): SpeakHandle {
  const controller = new AbortController();
  let ctx: AudioContext | null = null;
  const sources: AudioBufferSourceNode[] = [];
  let stopped = false;

  const done = (async () => {
    ctx = new AudioContext({ sampleRate: 24000 });
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    let playhead = 0;
    let pending = new Uint8Array(0);
    let endsAt = 0;

    const playChunk = (incoming: Uint8Array) => {
      if (!ctx || stopped) return;
      const bytes = new Uint8Array(pending.length + incoming.length);
      bytes.set(pending);
      bytes.set(incoming, pending.length);
      const usable = bytes.length - (bytes.length % 2);
      pending = bytes.slice(usable);
      if (usable === 0) return;
      const samples = new Int16Array(bytes.buffer, 0, usable / 2);
      const floats = Float32Array.from(samples, (s) => s / 32768);
      const buffer = ctx.createBuffer(1, floats.length, 24000);
      buffer.copyToChannel(floats, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      if (playhead === 0) playhead = ctx.currentTime + 0.08;
      else playhead = Math.max(playhead, ctx.currentTime);
      source.start(playhead);
      playhead += buffer.duration;
      endsAt = playhead;
      sources.push(source);
      if (onLevel) {
        let sum = 0;
        for (let i = 0; i < floats.length; i += 64) sum += Math.abs(floats[i] ?? 0);
        onLevel(Math.min(1, (sum / (floats.length / 64)) * 4));
      }
    };

    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`TTS failed: ${res.status}`);

    const parser = createParser({
      onEvent(event) {
        let payload: { type?: string; audio?: string };
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) return;
        const binary = atob(payload.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        playChunk(bytes);
      },
    });

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      parser.feed(value);
    }

    const remaining = Math.max(0, endsAt - (ctx?.currentTime ?? 0)) * 1000 + 120;
    await new Promise((resolve) => setTimeout(resolve, stopped ? 0 : remaining));
    onLevel?.(0);
    await ctx?.close().catch(() => {});
    ctx = null;
  })();

  return {
    stop: () => {
      stopped = true;
      controller.abort();
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      onLevel?.(0);
      ctx?.close().catch(() => {});
      ctx = null;
    },
    done: done.catch(() => undefined) as Promise<void>,
  };
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
};

export function createRecognition(lang = "cs-CZ"): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
  if (!Ctor) return null;
  const recognition: SpeechRecognitionLike = new Ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}
