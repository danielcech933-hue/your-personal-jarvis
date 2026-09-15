import { useEffect, useRef } from "react";
import type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

export type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

declare global { interface Window { THREE?: any } }

type Props = { state: AvatarState; mood: AvatarMood; level: number; onAsk?: (question: string) => void };
type Action = "idle" | "walk" | "sit" | "spin" | "jump" | "flip" | "wave";
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function material(T: any, color: number, emissive = 0, roughness = 0.55, metalness = 0.15) {
  return new T.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 1.3 : 0, roughness, metalness });
}
function add(T: any, parent: any, geometry: any, mat: any, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1]) {
  const m = new T.Mesh(geometry, mat); m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function createCharacter(T: any) {
  const root = new T.Group(); const g: Record<string, any> = {};
  const white = material(T, 0xeaf6ff, 0x193c66, 0.35, 0.3), dark = material(T, 0x0a1120, 0x021a36, 0.22, 0.7), cyan = material(T, 0x55e9ff, 0x00d9ff, 0.2, 0.55), gold = material(T, 0xd6b36c, 0x3b2400, 0.3, 0.72), skin = material(T, 0xf4d4d2, 0x18090c, 0.62, 0.05), eye = material(T, 0x8eefff, 0x00ddff, 0.12, 0.2), black = material(T, 0x02040a);
  g.body = new T.Group(); g.body.position.y = 1.7; root.add(g.body);
  add(T, g.body, new T.CapsuleGeometry(0.58, 0.85, 7, 18), dark, [0, 0.05, 0], [0.92, 1, 0.66]);
  add(T, g.body, new T.CapsuleGeometry(0.36, 0.45, 7, 16), white, [0, 0.14, 0.48], [1.08, 1.08, 0.26]);
  add(T, g.body, new T.TorusGeometry(0.23, 0.04, 10, 36), cyan, [0, 0.15, 0.72], [1, 1, 0.72]);
  add(T, g.body, new T.OctahedronGeometry(0.17, 1), cyan, [0, 0.15, 0.76]);
  g.head = new T.Group(); g.head.position.y = 1.15; g.body.add(g.head);
  add(T, g.head, new T.SphereGeometry(0.62, 28, 20), skin, [0, 0, 0], [1, 1, 0.92]);
  for (let i = -2; i <= 2; i++) add(T, g.head, new T.SphereGeometry(0.39, 18, 14), white, [i * 0.24, -0.1 - Math.abs(i) * 0.01, -0.35], [0.98, 1.45, 0.74]);
  for (let i = -3; i <= 3; i++) add(T, g.head, new T.SphereGeometry(0.2, 16, 12), white, [i * 0.17, 0.18 - Math.abs(i) * 0.025, -0.5], [1, 1.35, 0.55]);
  g.eyeL = add(T, g.head, new T.SphereGeometry(0.095, 16, 12), eye, [-0.2, 0.02, -0.56], [0.85, 1.4, 0.45]); g.eyeR = add(T, g.head, new T.SphereGeometry(0.095, 16, 12), eye, [0.2, 0.02, -0.56], [0.85, 1.4, 0.45]);
  add(T, g.head, new T.SphereGeometry(0.028, 10, 8), black, [0, -0.15, -0.58]); g.mouth = add(T, g.head, new T.SphereGeometry(0.037, 12, 8), black, [0, -0.14, -0.58], [1.9, 0.45, 0.4]);
  add(T, g.head, new T.TorusGeometry(0.48, 0.027, 8, 48), cyan, [0, 0.55, 0], [1, 0.52, 0.62]).rotation.x = Math.PI / 2;
  add(T, g.head, new T.TorusGeometry(0.17, 0.025, 8, 28), cyan, [-0.6, 0.03, 0], [1, 1.15, 0.72]); add(T, g.head, new T.TorusGeometry(0.17, 0.025, 8, 28), cyan, [0.6, 0.03, 0], [1, 1.15, 0.72]);
  g.hip = new T.Group(); g.hip.position.y = -0.7; g.body.add(g.hip);
  add(T, g.hip, new T.ConeGeometry(0.72, 0.45, 9, 1, true), white, [0, 0.02, 0], [1, 1, 0.72]); add(T, g.hip, new T.TorusGeometry(0.55, 0.045, 8, 28), cyan, [0, -0.17, 0], [1, 1, 0.72]);
  g.armL = new T.Group(); g.armR = new T.Group(); g.armL.position.set(-0.72, 0.3, 0); g.armR.position.set(0.72, 0.3, 0); g.body.add(g.armL, g.armR);
  add(T, g.armL, new T.CylinderGeometry(0.13, 0.17, 0.62, 14), white, [0, -0.3, 0]); add(T, g.armR, new T.CylinderGeometry(0.13, 0.17, 0.62, 14), white, [0, -0.3, 0]);
  g.foreL = new T.Group(); g.foreR = new T.Group(); g.foreL.position.y = -0.61; g.foreR.position.y = -0.61; g.armL.add(g.foreL); g.armR.add(g.foreR);
  add(T, g.foreL, new T.CylinderGeometry(0.115, 0.145, 0.6, 14), dark, [0, -0.3, 0]); add(T, g.foreR, new T.CylinderGeometry(0.115, 0.145, 0.6, 14), dark, [0, -0.3, 0]); add(T, g.foreL, new T.SphereGeometry(0.14, 14, 10), white, [0, -0.61, 0]); add(T, g.foreR, new T.SphereGeometry(0.14, 14, 10), white, [0, -0.61, 0]);
  g.thighL = new T.Group(); g.thighR = new T.Group(); g.thighL.position.set(-0.3, -0.98, 0); g.thighR.position.set(0.3, -0.98, 0); g.hip.add(g.thighL, g.thighR);
  add(T, g.thighL, new T.CylinderGeometry(0.16, 0.13, 0.68, 14), white, [0, -0.33, 0]); add(T, g.thighR, new T.CylinderGeometry(0.16, 0.13, 0.68, 14), white, [0, -0.33, 0]);
  g.calfL = new T.Group(); g.calfR = new T.Group(); g.calfL.position.y = -0.68; g.calfR.position.y = -0.68; g.thighL.add(g.calfL); g.thighR.add(g.calfR);
  add(T, g.calfL, new T.CylinderGeometry(0.12, 0.1, 0.7, 14), dark, [0, -0.35, 0]); add(T, g.calfR, new T.CylinderGeometry(0.12, 0.1, 0.7, 14), dark, [0, -0.35, 0]);
  g.bootL = add(T, g.calfL, new T.CapsuleGeometry(0.18, 0.28, 6, 12), white, [0, -0.78, -0.17], [1, 0.55, 1.45]); g.bootR = add(T, g.calfR, new T.CapsuleGeometry(0.18, 0.28, 6, 12), white, [0, -0.78, -0.17], [1, 0.55, 1.45]);
  add(T, g.bootL, new T.TorusGeometry(0.11, 0.022, 8, 22), cyan, [0, 0, -0.18], [1, 0.7, 0.9]); add(T, g.bootR, new T.TorusGeometry(0.11, 0.022, 8, 22), cyan, [0, 0, -0.18], [1, 0.7, 0.9]);
  return { root, g, cyan, eyes: [g.eyeL, g.eyeR] };
}
function resetRig(c: any) { const g = c.g; g.body.position.y = 1.7; g.body.rotation.set(0, 0, 0); g.head.rotation.set(0, 0, 0); g.hip.rotation.set(0, 0, 0); g.armL.rotation.set(0, 0, 0.08); g.armR.rotation.set(0, 0, -0.08); g.foreL.rotation.set(0, 0, 0); g.foreR.rotation.set(0, 0, 0); g.thighL.rotation.set(0, 0, 0); g.thighR.rotation.set(0, 0, 0); g.calfL.rotation.set(0, 0, 0); g.calfR.rotation.set(0, 0, 0); g.bootL.rotation.set(0, 0, 0); g.bootR.rotation.set(0, 0, 0); }
function animateRig(c: any, action: Action, t: number, level: number, mood: AvatarMood) {
  const g = c.g; resetRig(c); const walk = Math.sin(t * 8); const alt = Math.sin(t * 8 + Math.PI); g.body.position.y += Math.sin(t * 2.3) * 0.025;
  if (action === "walk") { g.thighL.rotation.x = walk * 0.62; g.thighR.rotation.x = alt * 0.62; g.calfL.rotation.x = Math.max(0, -walk) * 0.48; g.calfR.rotation.x = Math.max(0, -alt) * 0.48; g.armL.rotation.x = alt * 0.5; g.armR.rotation.x = walk * 0.5; g.body.rotation.z = Math.sin(t * 4) * 0.035; g.body.position.y += Math.abs(walk) * 0.035; }
  if (action === "wave") { g.armR.rotation.z = -0.92; g.armR.rotation.x = -0.32; g.foreR.rotation.z = -0.76 + Math.sin(t * 10) * 0.32; g.head.rotation.z = Math.sin(t * 2) * 0.08; }
  if (action === "sit") { g.body.position.y = 1.28; g.body.rotation.x = -0.2; g.hip.rotation.x = 0.16; g.thighL.rotation.x = -1.2; g.thighR.rotation.x = -1.2; g.calfL.rotation.x = 1.22; g.calfR.rotation.x = 1.22; g.head.rotation.x = mood === "sleep" ? 0.25 : 0.04; if (mood === "sleep") g.head.rotation.z = 0.08; }
  if (action === "spin") g.body.rotation.y = t * Math.PI * 1.8;
  if (action === "jump") { const p = (t % 1.25) / 1.25; g.body.position.y = 1.7 + Math.sin(p * Math.PI) * 1.1; g.armL.rotation.z = 0.55; g.armR.rotation.z = -0.55; g.thighL.rotation.x = -0.28; g.thighR.rotation.x = 0.28; g.calfL.rotation.x = 0.7; g.calfR.rotation.x = 0.7; }
  if (action === "flip") { g.body.rotation.x = t * Math.PI * 2.3; g.armL.rotation.z = 0.72; g.armR.rotation.z = -0.72; g.thighL.rotation.x = 0.35; g.thighR.rotation.x = -0.35; }
  if (action === "idle") { g.head.rotation.y = Math.sin(t * 1.15) * 0.08; g.head.rotation.z = Math.sin(t * 0.8) * 0.035; }
  g.mouth.scale.y = level > 0.02 ? 0.45 + Math.min(level, 1) * 0.65 : 0.45; c.cyan.emissiveIntensity = level > 0.02 ? 1.3 + Math.min(level, 1) * 3.2 : 1.25;
  const sleeping = mood === "sleep" && action === "sit"; c.eyes.forEach((e: any) => { e.scale.y = sleeping ? 0.12 : 1; });
}

export function JarvisCompanion({ state, mood, level }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null); const propsRef = useRef({ state, mood, level });
  useEffect(() => { propsRef.current = { state, mood, level }; }, [state, mood, level]);
  useEffect(() => {
    const mount = mountRef.current; const T = window.THREE; if (!mount || !T) return;
    const scene = new T.Scene(); const camera = new T.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100); camera.position.set(0, 2.7, 8.7); camera.lookAt(0, 1.8, 0);
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; mount.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight(0xa6ddff, 0x07111d, 2.2)); const key = new T.DirectionalLight(0xffffff, 3.5); key.position.set(4, 7, 6); key.castShadow = true; scene.add(key); const cyanLight = new T.PointLight(0x19dcff, 11, 16); cyanLight.position.set(-4, 3, 1); scene.add(cyanLight); const goldLight = new T.PointLight(0xffc86b, 3.5, 9); goldLight.position.set(4, 2, 2); scene.add(goldLight);
    const shadow = new T.Mesh(new T.CircleGeometry(1.2, 40), new T.MeshBasicMaterial({ color: 0x42e8ff, transparent: true, opacity: 0.1, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.6, 0.55, 1); shadow.position.y = 0.05; scene.add(shadow);
    const character = createCharacter(T); character.root.scale.setScalar(1.05); scene.add(character.root);
    let x = 0, z = 0, targetX = 0, targetZ = 0, action: Action = "idle", actionStarted = performance.now() / 1000, nextAction = actionStarted + 3.5, pointerX = 0, pointerY = 0, raf = 0;
    const chooseAction = (now: number) => { const { state, mood } = propsRef.current; if (state !== "idle") { action = "idle"; nextAction = now + 1.2; return; } const pool: Action[] = mood === "play" ? ["walk", "walk", "jump", "spin", "flip", "wave"] : mood === "bored" ? ["walk", "sit", "wave", "idle"] : mood === "sleep" ? ["sit", "sit", "idle"] : ["walk", "walk", "wave", "spin", "idle"]; action = pool[Math.floor(Math.random() * pool.length)]; actionStarted = now; nextAction = now + (action === "walk" ? 4.5 + Math.random() * 3.5 : action === "flip" ? 1.8 : action === "spin" ? 2.5 : 1.6 + Math.random() * 2.2); if (action === "walk") { targetX = (Math.random() - 0.5) * 6.1; targetZ = (Math.random() - 0.5) * 1.5; } };
    const onPointer = (e: PointerEvent) => { pointerX = (e.clientX / Math.max(innerWidth, 1)) * 2 - 1; pointerY = (e.clientY / Math.max(innerHeight, 1)) * 2 - 1; };
    window.addEventListener("pointermove", onPointer, { passive: true }); chooseAction(performance.now() / 1000);
    const loop = () => { const now = performance.now() / 1000; if (now >= nextAction) chooseAction(now); if (action === "walk") { const dx = targetX - x, dz = targetZ - z, dist = Math.hypot(dx, dz); if (dist < 0.08) nextAction = Math.min(nextAction, now + 0.4); else { const speed = 0.014; x += (dx / Math.max(dist, 0.001)) * speed; z += (dz / Math.max(dist, 0.001)) * speed; character.root.rotation.y = Math.atan2(dx, dz); } } x = clamp(x, -3.15, 3.15); z = clamp(z, -1.1, 1.1); character.root.position.set(x, 0, z); animateRig(character, action, now - actionStarted, propsRef.current.level, propsRef.current.mood); character.g.head.rotation.y += clamp(pointerX - x * 0.04, -0.2, 0.2) * 0.22; character.g.head.rotation.x += clamp(-pointerY * 0.08, -0.08, 0.08) * 0.2; shadow.position.x = x; shadow.position.z = z; shadow.material.opacity = action === "jump" || action === "flip" ? 0.035 : 0.1; renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }; window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", onPointer); renderer.dispose(); renderer.domElement.remove(); scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) Array.isArray(o.material) ? o.material.forEach((m: any) => m.dispose()) : o.material.dispose(); }); };
  }, []);
  return <div ref={mountRef} className="jarvis-3d-layer" aria-label="Živý 3D Jarvis" />;
}
