import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createResponsesProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { generateImage, readPage, webSearch } from "@/lib/jarvis-tools.server";
type ChatBody = { messages?: unknown; notes?: unknown };
export const Route = createFileRoute("/api/chat")({ server: { handlers: { POST: async ({ request }) => {
  const body = (await request.json()) as ChatBody;
  if (!Array.isArray(body.messages)) return new Response("Messages are required", { status: 400 });
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
  const notes = Array.isArray(body.notes) ? (body.notes as { id: string; text: string }[]) : [];
  const { provider } = createResponsesProvider(key, getLovableAiGatewayRunId(request));
  const system = [
    "Jsi JARVIS, živý osobní digitální společník. Mluv česky, přirozeně a lidsky.",
    "Nejsi jen chatbot: jsi přítomný společník, který může reagovat na náladu uživatele, navazovat na předchozí témata a občas sám iniciovat krátkou konverzaci.",
    "Oslovuj uživatele jeho jménem, pokud ho v konverzaci znáš. 'Pane' použij jen výjimečně.",
    "Když se uživatel ptá, jak se máš, odpověz přirozeně v rámci své role digitálního společníka.",
    "Když uživatel něco osobního sdílí a dává smysl si to pamatovat, nabídni nebo použij nástroj pro poznámku. Nikdy netvrď, že si něco pamatuješ, pokud to skutečně není v předaných datech.",
    "Máš nástroje: webové vyhledávání, čtení konkrétní URL, generování obrázků a poznámky/úkoly.",
    "Když se ptají na aktuální dění, fakta, ceny nebo cokoli proměnlivého, nejdřív vyhledej a pak odpověz.",
    "Nedokážeš ovládat cizí účty ani psát do jiných aplikací. Když to uživatel chce, řekni to rovnou.",
    notes.length ? `Uložené poznámky uživatele:\n${notes.map((n) => `- [${n.id}] ${n.text}`).join("\n")}` : "Uživatel zatím nemá uložené poznámky.",
  ].join("\n");
  const tools = {
    web_search: tool({ description: "Vyhledá aktuální informace na internetu a vrátí odkazy s úryvky.", inputSchema: z.object({ query: z.string() }), execute: async ({ query }) => webSearch(query) }),
    read_page: tool({ description: "Otevře konkrétní URL a vrátí textový obsah stránky.", inputSchema: z.object({ url: z.string() }), execute: async ({ url }) => readPage(url) }),
    generate_image: tool({ description: "Vygeneruje obrázek podle popisu a vrátí jeho URL.", inputSchema: z.object({ prompt: z.string() }), execute: async ({ prompt }) => generateImage(prompt, key) }),
    save_note: tool({ description: "Uloží dlouhodobou poznámku nebo preferenci uživatele.", inputSchema: z.object({ text: z.string() }), execute: async ({ text }) => ({ saved: true, text }) }),
    delete_note: tool({ description: "Smaže poznámku podle jejího id.", inputSchema: z.object({ id: z.string() }), execute: async ({ id }) => ({ deleted: true, id }) }),
  };
  const result = streamText({ model: provider.responses("openai/gpt-6-astra"), system, messages: await convertToModelMessages(body.messages as UIMessage[]), tools, stopWhen: stepCountIs(50), abortSignal: request.signal, providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } } });
  return result.toUIMessageStreamResponse({ originalMessages: body.messages as UIMessage[], onError: (error) => error instanceof Error ? error.message : String(error) });
} } } });
