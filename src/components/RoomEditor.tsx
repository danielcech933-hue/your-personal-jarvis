import { useEffect, useState } from "react";
import { Armchair, Home, Lamp, Leaf, Monitor, RotateCw, Undo2 } from "lucide-react";
import { COLOR_SWATCHES, ENVIRONMENTS, FURNITURE_LABELS, ROOM_BOUNDS, VARIANTS, clampRoom, loadRoomLayout, presetLayout, saveRoomLayout, type FurnitureId, type RoomEnvironment, type RoomLayout } from "@/lib/room-layout";

const ICONS: Record<FurnitureId, typeof Monitor> = { desk: Monitor, sofa: Armchair, decor: Leaf, lamp: Lamp };
const ENV_COMMENTS: Record<RoomEnvironment, string> = { cyber: "Zpátky v mém pokoji, tady se mi pracuje nejlíp.", park: "Jdeme ven! Čerstvý vzduch mi udělá dobře.", apartment: "Tady je to útulné, skoro jako doma.", rooftop: "Ten výhled na město je úžasný." };

export function RoomEditor({ onClose }: { onClose: () => void }) {
  const [layout, setLayout] = useState<RoomLayout>(() => loadRoomLayout());
  const [selected, setSelected] = useState<FurnitureId>("desk");
  useEffect(() => { setLayout(loadRoomLayout()); }, []);
  const commit = (next: RoomLayout, change: string) => { setLayout(next); saveRoomLayout(next, change); };
  const item = layout.items[selected];
  const patch = (p: Partial<typeof item>, change: string) => commit({ ...layout, items: { ...layout.items, [selected]: { ...item, ...p } } }, change);
  const W = 260, H = 120; const sx = (x: number) => ((x - ROOM_BOUNDS.minX) / (ROOM_BOUNDS.maxX - ROOM_BOUNDS.minX)) * W; const sz = (z: number) => ((z - ROOM_BOUNDS.minZ) / (ROOM_BOUNDS.maxZ - ROOM_BOUNDS.minZ)) * H;
  const onMap = (e: React.PointerEvent<HTMLDivElement>) => { if (e.type === "pointermove" && e.buttons !== 1) return; const r = e.currentTarget.getBoundingClientRect(); const x = clampRoom(ROOM_BOUNDS.minX + ((e.clientX - r.left) / r.width) * (ROOM_BOUNDS.maxX - ROOM_BOUNDS.minX), ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX); const z = clampRoom(ROOM_BOUNDS.minZ + ((e.clientY - r.top) / r.height) * (ROOM_BOUNDS.maxZ - ROOM_BOUNDS.minZ), ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ); patch({ x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20 }, `Přesouvám ${FURNITURE_LABELS[selected].toLowerCase()} – takhle je to lepší!`); };
  return (
    <section className="jarvis-popover jarvis-settings-popover">
      <div className="popover-title"><strong><Home className="inline h-4 w-4" /> Studio & domov</strong><button onClick={onClose}>×</button></div>
      <div className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Prostředí</div>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(ENVIRONMENTS) as RoomEnvironment[]).map((env) => <button key={env} type="button" onClick={() => commit(presetLayout(env), ENV_COMMENTS[env])} className={`rounded-lg border px-2 py-2 text-[11px] ${layout.env === env ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{ENVIRONMENTS[env].label}</button>)}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[.2em] text-muted-foreground">Nábytek</div>
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(FURNITURE_LABELS) as FurnitureId[]).map((id) => { const Icon = ICONS[id]; return <button key={id} type="button" onClick={() => setSelected(id)} className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] ${selected === id ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Icon className="h-4 w-4" />{FURNITURE_LABELS[id]}</button>; })}
      </div>
      <div className="text-[10px] text-muted-foreground">Táhni po plánku a přesuň vybraný kus:</div>
      <div onPointerDown={onMap} onPointerMove={onMap} className="relative cursor-crosshair touch-none rounded-lg border border-border bg-background/60" style={{ width: "100%", aspectRatio: `${W}/${H}` }}>
        <div className="absolute inset-x-0 top-0 h-1 bg-primary/30" />
        {(Object.keys(layout.items) as FurnitureId[]).map((id) => { const it = layout.items[id]; const Icon = ICONS[id]; return <div key={id} className={`absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md border ${id === selected ? "border-primary bg-primary/30 text-primary" : "border-border bg-card text-muted-foreground"}`} style={{ left: `${(sx(it.x) / W) * 100}%`, top: `${(sz(it.z) / H) * 100}%` }}><Icon className="h-3.5 w-3.5" /></div>; })}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {VARIANTS[selected].map((v) => <button key={v.value} type="button" onClick={() => patch({ variant: v.value }, `Nový kus: ${v.label.toLowerCase()}. Hezký výběr!`)} className={`rounded-lg border px-2 py-1.5 text-[11px] ${item.variant === v.value ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{v.label}</button>)}
      </div>
      <div className="flex items-center gap-1.5">
        {COLOR_SWATCHES.map((c) => <button key={c} type="button" aria-label={`Barva ${c}`} onClick={() => patch({ color: c }, "Ta barva tu sedí!")} className={`h-6 w-6 rounded-full border-2 ${item.color === c ? "border-primary" : "border-border"}`} style={{ background: c }} />)}
        <button type="button" onClick={() => patch({ rot: (item.rot + Math.PI / 4) % (Math.PI * 2) }, "Otáčím to, ať je to praktičtější.")} className="ml-auto rounded-md border border-border p-1.5 text-muted-foreground" aria-label="Otočit"><RotateCw className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => commit(presetLayout(layout.env), "Vracím všechno na původní místo.")} className="rounded-md border border-border p-1.5 text-muted-foreground" aria-label="Výchozí rozložení"><Undo2 className="h-3.5 w-3.5" /></button>
      </div>
    </section>
  );
}
