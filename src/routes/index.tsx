import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, MicOff, Send, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { JarvisAvatar } from "@/components/JarvisAvatar";
import { createRecognition, speak, type SpeakHandle } from "@/lib/speech";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JARVIS – osobní hlasový asistent" },
      {
        name: "description",
        content:
          "Vlastní JARVIS: mluv s ním živě hlasem, hledá na internetu, čte stránky, tvoří obrázky a pamatuje si tvoje úkoly.",
      },
      { property: "og:title", content: "JARVIS – osobní hlasový asistent" },
      {
        property: "og:description",
        content:
          "Živá hlasová konverzace s vlastním AI asistentem, který hledá na webu, čte stránky a pamatuje si úkoly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JarvisPage,
});

type Note = { id: string; text: string };

const NOTES_KEY = "jarvis.notes";

function textOf(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function JarvisPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef<Note[]>([]);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);

  const speakRef = useRef<SpeakHandle | null>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition>>(null);
  const wantListeningRef = useRef(false);
  const appliedToolsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Note[];
        setNotes(parsed);
        notesRef.current = parsed;
      }
    } catch {
      /* ignore */
    }
    setMicSupported(Boolean(createRecognition()));
  }, []);

  const persistNotes = useCallback((next: Note[]) => {
    notesRef.current = next;
    setNotes(next);
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, notes: notesRef.current },
        }),
      }),
    [],
  );

  const stopSpeaking = useCallback(() => {
    speakRef.current?.stop();
    speakRef.current = null;
    setSpeaking(false);
    setLevel(0);
  }, []);

  const startRecognition = useCallback(() => {
    if (!wantListeningRef.current) return;
    if (recognitionRef.current) return;
    const recognition = createRecognition();
    if (!recognition) {
      setMicSupported(false);
      return;
    }
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      let finalText = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else partial += result[0].transcript;
      }
      setInterim(partial);
      if (finalText.trim()) {
        setInterim("");
        submit(finalText.trim());
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      recognitionRef.current = null;
      if (wantListeningRef.current) setTimeout(startRecognition, 250);
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pauseRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const { messages, sendMessage, status, stop, setMessages } = useChat<UIMessage>({
    transport,
    onError: (err) => setError(err.message || "Něco se pokazilo."),
    onFinish: ({ message }) => {
      applyToolEffects(message);
      const reply = textOf(message);
      if (voiceOn && reply) {
        pauseRecognition();
        setSpeaking(true);
        const handle = speak(reply, setLevel);
        speakRef.current = handle;
        handle.done.finally(() => {
          speakRef.current = null;
          setSpeaking(false);
          setLevel(0);
          startRecognition();
        });
      } else {
        startRecognition();
      }
    },
  });

  const applyToolEffects = useCallback(
    (message: UIMessage) => {
      let next = [...notesRef.current];
      let changed = false;
      for (const part of message.parts as any[]) {
        const key = part.toolCallId as string | undefined;
        if (!key || appliedToolsRef.current.has(key)) continue;
        if (part.type === "tool-save_note" && part.input?.text) {
          appliedToolsRef.current.add(key);
          next = [...next, { id: crypto.randomUUID().slice(0, 6), text: part.input.text }];
          changed = true;
        }
        if (part.type === "tool-delete_note" && part.input?.id) {
          appliedToolsRef.current.add(key);
          next = next.filter((note) => note.id !== part.input.id);
          changed = true;
        }
      }
      if (changed) persistNotes(next);
    },
    [persistNotes],
  );

  const busy = status === "submitted" || status === "streaming";

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) return;
      setError(null);
      stopSpeaking();
      void sendMessage({ text: value });
    },
    [sendMessage, stopSpeaking],
  );

  const toggleListening = useCallback(async () => {
    if (listening) {
      wantListeningRef.current = false;
      pauseRecognition();
      setListening(false);
      setInterim("");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Potřebuju přístup k mikrofonu, jinak tě neuslyším.");
      return;
    }
    wantListeningRef.current = true;
    setListening(true);
    startRecognition();
  }, [listening, pauseRecognition, startRecognition]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim]);

  useEffect(
    () => () => {
      wantListeningRef.current = false;
      pauseRecognition();
      speakRef.current?.stop();
    },
    [pauseRecognition],
  );

  const orbState = speaking
    ? "speaking"
    : busy
      ? "thinking"
      : listening
        ? "listening"
        : "idle";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tvůj vlastní <span className="text-primary">JARVIS</span>
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Mluv na něj normálně. Hledá na internetu, přečte ti stránku, vytvoří obrázek a
          pamatuje si tvoje úkoly.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="jarvis-panel flex flex-col items-center gap-6 p-6">
          <JarvisAvatar state={orbState as any} level={level} />

          <div className="flex w-full flex-col gap-2">
            <button
              onClick={toggleListening}
              disabled={!micSupported}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? "Zastavit poslech" : "Začít mluvit"}
            </button>
            <button
              onClick={() => {
                setVoiceOn((prev) => !prev);
                stopSpeaking();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {voiceOn ? "Hlas zapnutý" : "Hlas vypnutý"}
            </button>
            {speaking && (
              <button
                onClick={stopSpeaking}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 px-4 py-2 text-sm text-accent"
              >
                <Square className="h-4 w-4" /> Přestaň mluvit
              </button>
            )}
            {!micSupported && (
              <p className="text-xs text-muted-foreground">
                Tenhle prohlížeč neumí rozpoznávat řeč – použij Chrome, nebo piš.
              </p>
            )}
          </div>

          <div className="w-full">
            <p className="jarvis-label mb-2">Poznámky a úkoly</p>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Řekni „zapamatuj si…“ a objeví se to tady.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                  >
                    <span>{note.text}</span>
                    <button
                      aria-label="Smazat poznámku"
                      onClick={() => persistNotes(notes.filter((n) => n.id !== note.id))}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="jarvis-panel flex min-h-[60vh] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Zkus: „Co je nového ve světě?“, „Přečti mi tuhle stránku…“, „Vygeneruj obrázek
                helmy Iron Mana“ nebo „Zapamatuj si, že mám zítra trénink.“
              </p>
            )}
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <p className="jarvis-label">
                  {message.role === "user" ? "Ty" : "Jarvis"}
                </p>
                {message.parts.map((part: any, index) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={index}
                        className="prose prose-sm prose-invert max-w-none rounded-xl bg-secondary/50 px-4 py-3"
                      >
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    );
                  }
                  if (part.type === "tool-generate_image" && part.output?.imageUrl) {
                    return (
                      <img
                        key={index}
                        src={part.output.imageUrl}
                        alt={part.input?.prompt ?? "Vygenerovaný obrázek"}
                        className="max-w-sm rounded-xl border border-border"
                      />
                    );
                  }
                  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                    const names: Record<string, string> = {
                      "tool-web_search": "Hledám na internetu",
                      "tool-read_page": "Čtu stránku",
                      "tool-generate_image": "Kreslím obrázek",
                      "tool-save_note": "Ukládám poznámku",
                      "tool-delete_note": "Mažu poznámku",
                    };
                    return (
                      <p key={index} className="jarvis-label">
                        {names[part.type] ?? part.type}
                        {part.state === "output-available" ? " ✓" : "…"}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
            {interim && <p className="text-sm italic text-muted-foreground">{interim}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
              setInput("");
            }}
            className="flex items-center gap-2 border-t border-border p-4"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Napiš Jarvisovi…"
              className="flex-1 rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-xl border border-border px-4 py-3 text-sm"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-3 text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
              aria-label="Vymazat konverzaci"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
