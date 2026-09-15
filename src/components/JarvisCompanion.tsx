import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";
export type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

type Props = { state: AvatarState; mood: AvatarMood; level: number; onAsk?: (question: string) => void };
type Action = "idle" | "walk" | "sit" | "spin" | "jump" | "flip" | "wave";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function mat(color: number, emissive = 0, roughness = 0.5, metalness = 0.2) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 1.3 : 0, roughness, metalness });
}

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale: [number, number, number] = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function createCharacter() {
  const root = new THREE.Group();
  const g: Record<string, any> = {};
  const white = mat(0xeaf6ff, 0x193c66, 0.32, 0.34);
  const dark = mat(0x0a1120, 0x021a36, 0.22, 0.72);
  const cyan = mat(0x55e9ff, 0x00d9ff, 0.2, 0.58);
  const skin = mat(0xf4d4d2, 0x18090c, 0.62, 0.05);
  const eye = mat(0x8eefff, 0x00ddff, 0.12, 0.22);
  const black = mat(0x02040a, 0, 0.4, 0.1);

  g.body = new THREE.Group();
  g.body.position.y = 2.0;
  root.add(g.body);
  mesh(g.body, new THREE.CapsuleGeometry(0.62, 0.9, 8, 20), dark, [0, 0, 0], [0.92, 1, 0.7]);
  mesh(g.body, new THREE.CapsuleGeometry(0.38, 0.45, 8, 18), white, [0, 0.14, 0.48], [1.08, 1.08, 0.27]);
  mesh(g.body, new THREE.TorusGeometry(0.23, 0.04, 10, 36), cyan, [0, 0.15, 0.72], [1, 1, 0.72]);
  mesh(g.body, new THREE.OctahedronGeometry(0.17, 1), cyan, [0, 0.15, 0.76]);

  g.head = new THREE.Group();
  g.head.position.y = 1.18;
  g.body.add(g.head);
  mesh(g.head, new THREE.SphereGeometry(0.64, 32, 24), skin, [0, 0, 0], [1, 1, 0.93]);
  for (let i = -2; i <= 2; i++) mesh(g.head, new THREE.SphereGeometry(0.4, 18, 14), white, [i * 0.25, -0.11, -0.35], [0.98, 1.48, 0.74]);
  for (let i = -3; i <= 3; i++) mesh(g.head, new THREE.SphereGeometry(0.2, 16, 12), white, [i * 0.175, 0.18 - Math.abs(i) * 0.027, -0.5], [1, 1.36, 0.55]);

  g.eyeL = mesh(g.head, new THREE.SphereGeometry(0.095, 16, 12), eye, [-0.21, 0.03, -0.575], [0.85, 1.42, 0.45]);
  g.eyeR = mesh(g.head, new THREE.SphereGeometry(0.095, 16, 12), eye, [0.21, 0.03, -0.575], [0.85, 1.42, 0.45]);
  g.mouth = mesh(g.head, new THREE.SphereGeometry(0.04, 12, 8), black, [0, -0.16, -0.585], [1.9, 0.45, 0.4]);

  const halo = mesh(g.head, new THREE.TorusGeometry(0.5, 0.027, 8, 56), cyan, [0, 0.56, 0], [1, 0.52, 0.62]);
  halo.rotation.x = Math.PI / 2;
  mesh(g.head, new THREE.TorusGeometry(0.18, 0.025, 8, 30), cyan, [-0.61, 0.03, 0], [1, 1.16, 0.72]);
  mesh(g.head, new THREE.TorusGeometry(0.18, 0.025, 8, 30), cyan, [0.61, 0.03, 0], [1, 1.16, 0.72]);

  g.hip = new THREE.Group();
  g.hip.position.y = -0.76;
  g.body.add(g.hip);
  mesh(g.hip, new THREE.ConeGeometry(0.73, 0.48, 10, 1, true), white, [0, 0, 0], [1, 1, 0.72]);
  mesh(g.hip, new THREE.TorusGeometry(0.56, 0.045, 8, 28), cyan, [0, -0.18, 0], [1, 1, 0.72]);

  g.armL = new THREE.Group(); g.armR = new THREE.Group();
  g.armL.position.set(-0.76, 0.3, 0); g.armR.position.set(0.76, 0.3, 0);
  g.body.add(g.armL, g.armR);
  mesh(g.armL, new THREE.CylinderGeometry(0.13, 0.17, 0.62, 16), white, [0, -0.3, 0]);
  mesh(g.armR, new THREE.CylinderGeometry(0.13, 0.17, 0.62, 16), white, [0, -0.3, 0]);
  g.foreL = new THREE.Group(); g.foreR = new THREE.Group();
  g.foreL.position.y = -0.61; g.foreR.position.y = -0.61;
  g.armL.add(g.foreL); g.armR.add(g.foreR);
  mesh(g.foreL, new THREE.CylinderGeometry(0.115, 0.145, 0.6, 16), dark, [0, -0.3, 0]);
  mesh(g.foreR, new THREE.CylinderGeometry(0.115, 0.145, 0.6, 16), dark, [0, -0.3, 0]);
  mesh(g.foreL, new THREE.SphereGeometry(0.14, 14, 10), white, [0, -0.61, 0]);
  mesh(g.foreR, new THREE.SphereGeometry(0.14, 14, 10), white, [0, -0.61, 0]);

  g.thighL = new THREE.Group(); g.thighR = new THREE.Group();
  g.thighL.position.set(-0.31, -1.02, 0); g.thighR.position.set(0.31, -1.02, 0);
  g.hip.add(g.thighL, g.thighR);
  mesh(g.thighL, new THREE.CylinderGeometry(0.16, 0.13, 0.68, 16), white, [0, -0.33, 0]);
  mesh(g.thighR, new THREE.CylinderGeometry(0.16, 0.13, 0.68, 16), white, [0, -0.33, 0]);
  g.calfL = new THREE.Group(); g.calfR = new THREE.Group();
  g.calfL.position.y = -0.68; g.calfR.position.y = -0.68;
  g.thighL.add(g.calfL); g.thighR.add(g.calfR);
  mesh(g.calfL, new THREE.CylinderGeometry(0.12, 0.1, 0.7, 16), dark, [0, -0.35, 0]);
  mesh(g.calfR, new THREE.CylinderGeometry(0.12, 0.1, 0.7, 16), dark, [0, -0.35, 0]);
  g.bootL = mesh(g.calfL, new THREE.CapsuleGeometry(0.19, 0.3, 7, 14), white, [0, -0.78, -0.19], [1, 0.56, 1.48]);
  g.bootR = mesh(g.calfR, new THREE.CapsuleGeometry(0.19, 0.3, 7, 14), white, [0, -0.78, -0.19], [1, 0.56, 1.48]);
  mesh(g.bootL, new THREE.TorusGeometry(0.11, 0.022, 8, 24), cyan, [0, 0, -0.18], [1, 0.7, 0.9]);
  mesh(g.bootR, new THREE.TorusGeometry(0.11, 0.022, 8, 24), cyan, [0, 0, -0.18], [1, 0.7, 0.9]);

  return { root, g, cyan, eyes: [g.eyeL, g.eyeR] };
}

function resetRig(c: any) {
  const g = c.g;
  g.body.position.y = 2.0; g.body.rotation.set(0, 0, 0);
  g.head.rotation.set(0, 0, 0); g.hip.rotation.set(0, 0, 0);
  g.armL.rotation.set(0, 0, 0.08); g.armR.rotation.set(0, 0, -0.08);
  g.foreL.rotation.set(0, 0, 0); g.foreR.rotation.set(0, 0, 0);
  g.thighL.rotation.set(0, 0, 0); g.thighR.rotation.set(0, 0, 0);
  g.calfL.rotation.set(0, 0, 0); g.calfR.rotation.set(0, 0, 0);
}

function animateRig(c: any, action: Action, t: number, level: number, mood: AvatarMood) {
  const g = c.g;
  const walk = Math.sin(t * 8);
  const alt = Math.sin(t * 8 + Math.PI);
  resetRig(c);
  g.body.position.y += Math.sin(t * 2.3) * 0.025;

  if (action === "walk") {
    g.thighL.rotation.x = walk * 0.62; g.thighR.rotation.x = alt * 0.62;
    g.calfL.rotation.x = Math.max(0, -walk) * 0.48; g.calfR.rotation.x = Math.max(0, -alt) * 0.48;
    g.armL.rotation.x = alt * 0.5; g.armR.rotation.x = walk * 0.5;
    g.body.rotation.z = Math.sin(t * 4) * 0.035; g.body.position.y += Math.abs(walk) * 0.035;
  }
  if (action === "wave") {
    g.armR.rotation.z = -0.92; g.armR.rotation.x = -0.32; g.foreR.rotation.z = -0.76 + Math.sin(t * 10) * 0.32; g.head.rotation.z = Math.sin(t * 2) * 0.08;
  }
  if (action === "sit") {
    g.body.position.y = 1.32; g.body.rotation.x = -0.2; g.hip.rotation.x = 0.16;
    g.thighL.rotation.x = -1.2; g.thighR.rotation.x = -1.2; g.calfL.rotation.x = 1.22; g.calfR.rotation.x = 1.22;
    g.head.rotation.x = mood === "sleep" ? 0.25 : 0.04;
    if (mood === "sleep") g.head.rotation.z = 0.08;
  }
  if (action === "spin") g.body.rotation.y = t * Math.PI * 1.8;
  if (action === "jump") {
    const p = (t % 1.25) / 1.25; g.body.position.y = 2.0 + Math.sin(p * Math.PI) * 1.1;
    g.armL.rotation.z = 0.55; g.armR.rotation.z = -0.55; g.thighL.rotation.x = -0.28; g.thighR.rotation.x = 0.28; g.calfL.rotation.x = 0.7; g.calfR.rotation.x = 0.7;
  }
  if (action === "flip") {
    g.body.rotation.x = t * Math.PI * 2.3; g.armL.rotation.z = 0.72; g.armR.rotation.z = -0.72; g.thighL.rotation.x = 0.35; g.thighR.rotation.x = -0.35;
  }
  if (action === "idle") {
    g.head.rotation.y = Math.sin(t * 1.15) * 0.08; g.head.rotation.z = Math.sin(t * 0.8) * 0.035;
  }

  g.mouth.scale.y = level > 0.02 ? 0.45 + Math.min(level, 1) * 0.65 : 0.45;
  c.cyan.emissiveIntensity = level > 0.02 ? 1.3 + Math.min(level, 1) * 3.2 : 1.25;
  const sleeping = mood === "sleep" && action === "sit";
  c.eyes.forEach((eye: any) => { eye.scale.y = sleeping ? 0.12 : 1; });
}

export function JarvisCompanion({ state, mood, level }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ state, mood, level });
  useEffect(() => { propsRef.current = { state, mood, level }; }, [state, mood, level]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 3.0, 9.0);
    camera.lookAt(0, 2.0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xa6ddff, 0x07111d, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.5); key.position.set(4, 7, 6); key.castShadow = true; scene.add(key);
    const cyanLight = new THREE.PointLight(0x19dcff, 11, 16); cyanLight.position.set(-4, 3, 1); scene.add(cyanLight);
    const goldLight = new THREE.PointLight(0xffc86b, 3.5, 9); goldLight.position.set(4, 2, 2); scene.add(goldLight);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshBasicMaterial({ color: 0x42e8ff, transparent: true, opacity: 0.1, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.scale.set(1.6, 0.55, 1); floor.position.y = 0.05; scene.add(floor);

    const character = createCharacter();
    character.root.scale.setScalar(1.05);
    scene.add(character.root);

    let x = 0, z = 0, targetX = 0, targetZ = 0;
    let action: Action = "idle";
    let actionStarted = performance.now() / 1000;
    let nextAction = actionStarted + 3;
    let pointerX = 0, pointerY = 0;
    let raf = 0;

    const chooseAction = (now: number) => {
      const { state, mood } = propsRef.current;
      if (state !== "idle") { action = "idle"; nextAction = now + 1.2; return; }
      const pool: Action[] = mood === "play"
        ? ["walk", "walk", "jump", "spin", "flip", "wave"]
        : mood === "bored"
          ? ["walk", "sit", "wave", "idle"]
          : mood === "sleep"
            ? ["sit", "sit", "idle"]
            : ["walk", "walk", "wave", "spin", "idle"];
      action = pool[Math.floor(Math.random() * pool.length)];
      actionStarted = now;
      nextAction = now + (action === "walk" ? 4.5 + Math.random() * 3.5 : action === "flip" ? 1.8 : action === "spin" ? 2.5 : 1.6 + Math.random() * 2.2);
      if (action === "walk") { targetX = (Math.random() - 0.5) * 6.1; targetZ = (Math.random() - 0.5) * 1.5; }
    };

    const onPointer = (e: PointerEvent) => { pointerX = (e.clientX / Math.max(innerWidth, 1)) * 2 - 1; pointerY = (e.clientY / Math.max(innerHeight, 1)) * 2 - 1; };
    window.addEventListener("pointermove", onPointer, { passive: true });
    chooseAction(performance.now() / 1000);

    const loop = () => {
      const now = performance.now() / 1000;
      if (now >= nextAction) chooseAction(now);
      if (action === "walk") {
        const dx = targetX - x, dz = targetZ - z, dist = Math.hypot(dx, dz);
        if (dist < 0.08) nextAction = Math.min(nextAction, now + 0.4);
        else { const speed = 0.025; x += (dx / Math.max(dist, 0.001)) * speed; z += (dz / Math.max(dist, 0.001)) * speed; character.root.rotation.y = Math.atan2(dx, dz); }
      }
      x = clamp(x, -3.15, 3.15); z = clamp(z, -1.1, 1.1);
      character.root.position.set(x, 0, z);
      animateRig(character, action, now - actionStarted, propsRef.current.level, propsRef.current.mood);
      character.g.head.rotation.y += clamp(pointerX, -0.2, 0.2) * 0.08;
      character.g.head.rotation.x += clamp(-pointerY * 0.08, -0.08, 0.08) * 0.08;
      floor.position.x = x; floor.position.z = z;
      floor.material.opacity = action === "jump" || action === "flip" ? 0.035 : 0.1;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", onPointer); renderer.dispose(); renderer.domElement.remove(); };
  }, []);

  return <div ref={mountRef} className="jarvis-3d-layer" aria-label="Živý 3D Jarvis" />;
}
