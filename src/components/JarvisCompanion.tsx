import { useEffect, useRef, useState } from "react";
import { loadJarvisProfile, type JarvisAppearance } from "@/lib/jarvis-profile";
import { decideCompanionLife, getCompanionZonePosition, type CompanionAction, type CompanionMood, type CompanionZone } from "@/lib/companion-life";
import idleImage from "@/assets/companion-idle.png";
import talkImage from "@/assets/companion-talk.png";
import sleepImage from "@/assets/companion-sleep.png";
import playImage from "@/assets/companion-play.png";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export type AvatarMood = CompanionMood;
type Props = { state: AvatarState; mood: AvatarMood; level: number; appearance?: JarvisAppearance; onAsk?: (question: string) => void; onActivity?: (activity: string) => void };
type Action = CompanionAction;
type Runtime = { vrm: any; accentLight: any; modelBaseScale: any };

const MODEL_URLS = [
  "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/beta/Vita.vrm",
  "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/fem_vroid.vrm",
];
const DEFAULT_APPEARANCE: JarvisAppearance = { style: "glamorous", hair: "silver", outfit: "midnight", accent: "cyan", height: 1, body: "athletic" };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

let T: any = null;

const labels: Record<Action, string> = { idle: "Jen tak odpočívá", walk: "Prochází se po pokoji", sit: "Sedí a relaxuje", work: "Pracuje u svého stolu", sleep: "Spí na gauči", stretch: "Protahuje se", dance: "Tancuje", spin: "Točí se pro zábavu", jump: "Skáče", flip: "Dělá salto", wave: "Mává na tebe", think: "Přemýšlí" };
const palette = {
  hair: { silver: 0xddebf7, black: 0x151a28, violet: 0x9f78df, rose: 0xe18aa8 },
  outfit: { midnight: 0x142d4c, white: 0xdce5ef, crimson: 0x72192e },
  accent: { cyan: 0x46e9ff, violet: 0xb28cff, rose: 0xff82bd },
};

/** Where the character physically sits when performing a seated action in a zone. */
const SEAT_HEIGHT: Partial<Record<CompanionZone, number>> = { desk: 0.46, sofa: 0.44 };
/** Facing angle (radians) while performing an action in a zone; 0 = towards the viewer. */
const ZONE_YAW: Record<CompanionZone, number> = { center: 0, desk: Math.PI, sofa: 0.3, window: Math.PI, floor: -0.35 };

function bone(vrm: any, name: string) { return vrm?.humanoid?.getNormalizedBoneNode?.(name) ?? null; }

function capture(vrm: any) {
  const names = ["hips", "spine", "chest", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"];
  const pose: Record<string, any> = {};
  for (const name of names) { const bodyBone = bone(vrm, name); if (bodyBone) pose[name] = { bone: bodyBone, q: bodyBone.quaternion.clone() }; }
  return pose;
}

function rotate(pose: Record<string, any>, name: string, x = 0, y = 0, z = 0) {
  const entry = pose[name];
  if (!entry || !T) return;
  entry.bone.quaternion.copy(entry.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(x, y, z)));
}

function reset(pose: Record<string, any>) { for (const entry of Object.values(pose) as any[]) entry.bone.quaternion.copy(entry.q); }
function expression(vrm: any, name: string, value: number) { try { vrm?.expressionManager?.setValue?.(name, clamp(value, 0, 1)); } catch { /* expression missing on this model */ } }

function applyAppearance(runtime: Runtime, appearance: JarvisAppearance) {
  const { vrm, accentLight, modelBaseScale } = runtime;
  if (!vrm?.scene) return;
  const hairColor = palette.hair[appearance.hair];
  const outfitColor = palette.outfit[appearance.outfit];
  const accentColor = palette.accent[appearance.accent];
  const bodyScale = appearance.body === "slim" ? 0.93 : appearance.body === "curvy" ? 1.09 : 1;
  const height = clamp(appearance.height, 0.9, 1.1);
  vrm.scene.scale.set(modelBaseScale.x * bodyScale * height, modelBaseScale.y * height, modelBaseScale.z * bodyScale * height);
  accentLight?.color?.setHex?.(accentColor);
  vrm.scene.traverse((object: any) => {
    const raw = object.material;
    const materials = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const objectName = `${String(object?.name || "")}`.toLowerCase();
    for (const material of materials) {
      const name = `${objectName} ${String(material.name || "")}`.toLowerCase();
      if (name.includes("hair")) {
        material.color?.setHex?.(hairColor);
        if ("roughness" in material) material.roughness = 0.38;
        if ("metalness" in material) material.metalness = appearance.style === "cyber" ? 0.14 : 0.02;
      }
      if (/dress|cloth|skirt|top|outfit|onepiece|shoe|boot|heel/.test(name)) {
        material.color?.setHex?.(outfitColor);
        if ("roughness" in material) material.roughness = appearance.style === "glamorous" ? 0.26 : 0.46;
      }
      if (/eye|iris|glow|gem|tech/.test(name)) {
        material.emissive?.setHex?.(accentColor);
        if ("emissiveIntensity" in material) material.emissiveIntensity = appearance.style === "cyber" ? 0.24 : 0.07;
      }
      if (/skin|body|face/.test(name) && !/mask|clothing|shoe/.test(name)) {
        if ("roughness" in material) material.roughness = 0.5;
        if ("metalness" in material) material.metalness = 0;
      }
    }
  });
}

function animate(vrm: any, pose: Record<string, any>, action: Action, t: number, level: number, mood: AvatarMood) {
  reset(pose);
  const swing = Math.sin(t * 7);
  const slow = Math.sin(t * 1.25);
  const breathe = Math.sin(t * 1.55) * 0.02;
  if (action === "walk") {
    rotate(pose, "leftUpperLeg", swing * 0.52);
    rotate(pose, "rightUpperLeg", -swing * 0.52);
    rotate(pose, "leftLowerLeg", Math.max(0, -swing) * 0.5);
    rotate(pose, "rightLowerLeg", Math.max(0, swing) * 0.5);
    rotate(pose, "leftUpperArm", -swing * 0.34);
    rotate(pose, "rightUpperArm", swing * 0.34);
    rotate(pose, "chest", 0, 0, breathe);
  } else if (action === "wave") {
    rotate(pose, "rightUpperArm", -1.03, 0, -0.45);
    rotate(pose, "rightLowerArm", -0.2, 0, -0.9 + Math.sin(t * 10) * 0.22);
    rotate(pose, "head", 0, -0.08, 0.03);
  } else if (action === "sit" || action === "work") {
    rotate(pose, "leftUpperLeg", -1.35);
    rotate(pose, "rightUpperLeg", -1.35);
    rotate(pose, "leftLowerLeg", 1.45);
    rotate(pose, "rightLowerLeg", 1.45);
    rotate(pose, "spine", action === "work" ? -0.2 : -0.1);
    if (action === "work") {
      rotate(pose, "leftUpperArm", -0.62, 0, 0.2);
      rotate(pose, "rightUpperArm", -0.62, 0, -0.2);
      rotate(pose, "leftLowerArm", -0.5 + Math.sin(t * 9) * 0.05);
      rotate(pose, "rightLowerArm", -0.5 - Math.sin(t * 9) * 0.05);
      rotate(pose, "head", 0.1, slow * 0.06, 0);
    } else {
      rotate(pose, "leftUpperArm", -0.1, 0, 0.16);
      rotate(pose, "rightUpperArm", -0.1, 0, -0.16);
      rotate(pose, "chest", 0, 0, breathe);
    }
  } else if (action === "sleep") {
    rotate(pose, "leftUpperLeg", -1.25);
    rotate(pose, "rightUpperLeg", -1.2);
    rotate(pose, "leftLowerLeg", 1.4);
    rotate(pose, "rightLowerLeg", 1.42);
    rotate(pose, "spine", -0.14);
    rotate(pose, "head", 0.24, 0, 0.2);
    rotate(pose, "leftUpperArm", -0.12, 0, 0.3);
    rotate(pose, "rightUpperArm", -0.12, 0, -0.3);
  } else if (action === "stretch") {
    const k = Math.sin(t * 2.2);
    rotate(pose, "leftUpperArm", -2.1 + k * 0.12, 0, 0.3);
    rotate(pose, "rightUpperArm", -2.1 + k * 0.12, 0, -0.3);
    rotate(pose, "spine", -0.1 - k * 0.05);
    rotate(pose, "head", -0.12, 0, 0);
  } else if (action === "dance") {
    const k = Math.sin(t * 5.4);
    rotate(pose, "leftUpperLeg", k * 0.24);
    rotate(pose, "rightUpperLeg", -k * 0.24);
    rotate(pose, "leftUpperArm", -1.1 + k * 0.32, 0, 0.3);
    rotate(pose, "rightUpperArm", -1.1 - k * 0.32, 0, -0.3);
    rotate(pose, "chest", 0, 0, k * 0.1);
    rotate(pose, "head", 0, k * 0.12, 0);
  } else if (action === "jump") {
    const k = Math.sin(clamp(t / 1.15, 0, 1) * Math.PI);
    rotate(pose, "leftUpperLeg", -0.3 * k);
    rotate(pose, "rightUpperLeg", 0.3 * k);
    rotate(pose, "leftLowerLeg", 0.7 * k);
    rotate(pose, "rightLowerLeg", 0.7 * k);
    rotate(pose, "leftUpperArm", -1.3 * k, 0, 0.16 * k);
    rotate(pose, "rightUpperArm", -1.3 * k, 0, -0.16 * k);
  } else if (action === "spin") {
    rotate(pose, "leftUpperArm", -0.85, 0, 0.5);
    rotate(pose, "rightUpperArm", -0.85, 0, -0.5);
    rotate(pose, "chest", 0, 0, Math.sin(t * 4) * 0.06);
  } else if (action === "flip") {
    rotate(pose, "leftUpperArm", -1.6);
    rotate(pose, "rightUpperArm", -1.6);
    rotate(pose, "leftUpperLeg", -0.5);
    rotate(pose, "rightUpperLeg", -0.5);
    rotate(pose, "leftLowerLeg", 0.9);
    rotate(pose, "rightLowerLeg", 0.9);
  } else if (action === "think") {
    rotate(pose, "rightUpperArm", -0.72, 0, -0.34);
    rotate(pose, "rightLowerArm", -0.9, 0, -0.55);
    rotate(pose, "leftUpperArm", -0.2, 0, 0.22);
    rotate(pose, "head", 0.06, 0.12 + slow * 0.04, -0.05);
    rotate(pose, "chest", 0, 0, breathe);
  } else {
    rotate(pose, "head", Math.sin(t * 0.85) * 0.04, Math.sin(t * 0.55) * 0.03, Math.sin(t * 0.72) * 0.025);
    rotate(pose, "chest", 0, 0, breathe);
    rotate(pose, "leftUpperArm", 0, 0, 0.08 + breathe);
    rotate(pose, "rightUpperArm", 0, 0, -0.08 - breathe);
  }
  const sleeping = mood === "sleep" || action === "sleep";
  expression(vrm, "blink", sleeping ? 1 : Math.sin(t * 0.72) > 0.985 ? 1 : 0);
  expression(vrm, "aa", level > 0.03 ? Math.min(1, 0.12 + level * 0.9) : 0);
  expression(vrm, "happy", mood === "play" || action === "dance" ? 0.72 : mood === "curious" ? 0.22 : 0);
  expression(vrm, "relaxed", sleeping ? 0.58 : mood === "bored" ? 0.14 : 0);
}

function fallbackImage(action: Action, state: AvatarState, mood: AvatarMood) {
  if (state === "speaking") return talkImage;
  if (action === "sleep" || mood === "sleep") return sleepImage;
  if (action === "dance" || action === "jump" || action === "spin" || action === "flip" || mood === "play") return playImage;
  if (action === "wave" || state === "listening") return talkImage;
  return idleImage;
}

function visibleFallback(action: Action, state: AvatarState, mood: AvatarMood, appearance: JarvisAppearance) {
  return (
    <div className="jarvis-avatar-fallback" data-accent={appearance.accent} data-action={action} aria-label="Živá anime společnice">
      <div className="fallback-aura" />
      <div className="fallback-shadow" />
      <img
        src={fallbackImage(action, state, mood)}
        alt="Anime AI společnice"
        width={768}
        height={1344}
        loading="lazy"
        className="fallback-portrait"
        style={{ transform: `scale(${clamp(appearance.height, 0.9, 1.1)})` }}
      />
    </div>
  );
}

function addRoom(scene: any, appearance: JarvisAppearance) {
  const group = new T.Group();
  const accentColor = palette.accent[appearance.accent];
  const floorMaterial = new T.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.82, metalness: 0.04 });
  const wallMaterial = new T.MeshStandardMaterial({ color: 0x0b1726, roughness: 0.94, metalness: 0 });
  const furnitureMaterial = new T.MeshStandardMaterial({ color: 0x122238, roughness: 0.46, metalness: 0.14 });
  const softMaterial = new T.MeshStandardMaterial({ color: 0x1a2c44, roughness: 0.86, metalness: 0.02 });
  const trimMaterial = new T.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.4 });
  const glassMaterial = new T.MeshStandardMaterial({ color: 0x12324d, emissive: 0x0d3350, emissiveIntensity: 0.55, transparent: true, opacity: 0.8, roughness: 0.18, metalness: 0.1 });

  const floor = new T.Mesh(new T.PlaneGeometry(9, 6), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const rug = new T.Mesh(new T.CircleGeometry(1.5, 48), new T.MeshStandardMaterial({ color: 0x16283d, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.2, 0.005, 0.5);
  rug.receiveShadow = true;
  group.add(rug);

  const wall = new T.Mesh(new T.PlaneGeometry(9, 3.4), wallMaterial);
  wall.position.set(0, 1.7, -1.6);
  wall.receiveShadow = true;
  group.add(wall);

  const deskTop = new T.Mesh(new T.BoxGeometry(1.7, 0.06, 0.72), furnitureMaterial);
  deskTop.position.set(-1.9, 0.74, -0.95);
  deskTop.castShadow = true;
  group.add(deskTop);
  for (const x of [-2.68, -1.12]) {
    const leg = new T.Mesh(new T.BoxGeometry(0.07, 0.74, 0.07), furnitureMaterial);
    leg.position.set(x, 0.37, -0.95);
    group.add(leg);
  }
  const monitor = new T.Mesh(new T.BoxGeometry(0.66, 0.4, 0.04), furnitureMaterial);
  monitor.position.set(-1.9, 1.06, -1.2);
  group.add(monitor);
  const monitorGlow = new T.Mesh(new T.PlaneGeometry(0.6, 0.34), glassMaterial);
  monitorGlow.position.set(-1.9, 1.06, -1.175);
  group.add(monitorGlow);
  const monitorStand = new T.Mesh(new T.BoxGeometry(0.06, 0.12, 0.06), furnitureMaterial);
  monitorStand.position.set(-1.9, 0.83, -1.2);
  group.add(monitorStand);

  const chairSeat = new T.Mesh(new T.BoxGeometry(0.46, 0.07, 0.46), softMaterial);
  chairSeat.position.set(-1.9, 0.43, -0.35);
  chairSeat.castShadow = true;
  group.add(chairSeat);
  const chairBack = new T.Mesh(new T.BoxGeometry(0.46, 0.5, 0.07), softMaterial);
  chairBack.position.set(-1.9, 0.7, -0.14);
  group.add(chairBack);
  const chairPole = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.4, 12), furnitureMaterial);
  chairPole.position.set(-1.9, 0.2, -0.35);
  group.add(chairPole);

  const sofaBase = new T.Mesh(new T.BoxGeometry(1.8, 0.36, 0.9), furnitureMaterial);
  sofaBase.position.set(1.5, 0.18, 0.55);
  sofaBase.castShadow = true;
  group.add(sofaBase);
  const sofaSeat = new T.Mesh(new T.BoxGeometry(1.7, 0.12, 0.84), softMaterial);
  sofaSeat.position.set(1.5, 0.41, 0.57);
  sofaSeat.receiveShadow = true;
  group.add(sofaSeat);
  const sofaBack = new T.Mesh(new T.BoxGeometry(1.8, 0.55, 0.18), softMaterial);
  sofaBack.position.set(1.5, 0.63, 0.19);
  group.add(sofaBack);
  for (const x of [0.66, 2.34]) {
    const arm = new T.Mesh(new T.BoxGeometry(0.16, 0.24, 0.9), softMaterial);
    arm.position.set(x, 0.5, 0.55);
    group.add(arm);
  }

  const windowGlass = new T.Mesh(new T.PlaneGeometry(2.1, 1.35), glassMaterial);
  windowGlass.position.set(0.7, 1.55, -1.58);
  group.add(windowGlass);
  for (const x of [-0.37, 0.7, 1.77]) {
    const post = new T.Mesh(new T.BoxGeometry(0.04, 1.4, 0.04), trimMaterial);
    post.position.set(x, 1.55, -1.55);
    group.add(post);
  }
  for (const y of [0.87, 2.23]) {
    const bar = new T.Mesh(new T.BoxGeometry(2.16, 0.04, 0.04), trimMaterial);
    bar.position.set(0.7, y, -1.55);
    group.add(bar);
  }

  const pot = new T.Mesh(new T.CylinderGeometry(0.15, 0.12, 0.28, 16), furnitureMaterial);
  pot.position.set(2.9, 0.14, -0.9);
  group.add(pot);
  const plant = new T.Mesh(new T.SphereGeometry(0.28, 16, 12), new T.MeshStandardMaterial({ color: 0x1f5a45, roughness: 0.9 }));
  plant.position.set(2.9, 0.48, -0.9);
  plant.castShadow = true;
  group.add(plant);

  scene.add(group);
  return group;
}

export function JarvisCompanion({ state, mood, level, appearance = DEFAULT_APPEARANCE, onActivity }: Props) {
  const [liveAppearance, setLiveAppearance] = useState<JarvisAppearance>(() => loadJarvisProfile().appearance || appearance);
  const [vrmReady, setVrmReady] = useState(false);
  const [fallbackAction, setFallbackAction] = useState<Action>("idle");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ state, mood, level });
  const activityRef = useRef(onActivity);
  const appearanceRef = useRef(liveAppearance);
  const runtimeRef = useRef<Runtime | null>(null);

  useEffect(() => { propsRef.current = { state, mood, level }; }, [state, mood, level]);
  useEffect(() => { activityRef.current = onActivity; }, [onActivity]);
  useEffect(() => {
    const next = appearance || DEFAULT_APPEARANCE;
    appearanceRef.current = next;
    setLiveAppearance(next);
    if (runtimeRef.current) applyAppearance(runtimeRef.current, next);
  }, [appearance]);
  useEffect(() => {
    const handler = () => {
      const next = loadJarvisProfile().appearance || DEFAULT_APPEARANCE;
      appearanceRef.current = next;
      setLiveAppearance(next);
      if (runtimeRef.current) applyAppearance(runtimeRef.current, next);
    };
    window.addEventListener("jarvis-profile-updated", handler);
    return () => window.removeEventListener("jarvis-profile-updated", handler);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let raf = 0;
    let disposeScene: (() => void) | null = null;

    const setAction = (action: Action) => { setFallbackAction(action); activityRef.current?.(labels[action]); };

    const fallbackOnly = () => {
      setVrmReady(false);
      let until = 0;
      const choose = (now: number) => {
        const p = propsRef.current;
        const decision = decideCompanionLife(new Date(), p.mood);
        const action: Action = p.state === "thinking" ? "think" : p.state === "listening" ? "wave" : decision.action;
        until = now + (action === "sleep" ? 7.5 : 2.5 + Math.random() * 3.5);
        setAction(action);
      };
      const frame = (ms: number) => {
        if (cancelled) return;
        const now = ms / 1000;
        if (!until || now >= until) choose(now);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    const loadModel = async (loader: any) => {
      let lastError: unknown;
      for (const url of MODEL_URLS) {
        try { return await new Promise<any>((resolve, reject) => loader.load(url, resolve, undefined, reject)); }
        catch (error) { lastError = error; }
      }
      throw lastError || new Error("No VRM model could be loaded");
    };

    const boot = async () => {
      try {
        const [three, gltfModule, vrmModule] = await Promise.all([
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("@pixiv/three-vrm"),
        ]);
        if (cancelled) return;
        T = three;
        const { GLTFLoader } = gltfModule;
        const { VRMLoaderPlugin, VRMUtils } = vrmModule;

        const scene = new T.Scene();
        const width = Math.max(mount.clientWidth, 1);
        const height = Math.max(mount.clientHeight, 1);
        const camera = new T.PerspectiveCamera(30, width / height, 0.05, 100);
        camera.position.set(0.1, 1.42, 4.3);
        camera.lookAt(0, 0.92, -0.25);
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.className = "jarvis-3d-canvas";
        mount.appendChild(renderer.domElement);

        scene.add(new T.HemisphereLight(0xd9f5ff, 0x06101b, 1.9));
        const key = new T.DirectionalLight(0xffffff, 2.6);
        key.position.set(-2.6, 4.6, 4.2);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 5;
        key.shadow.camera.bottom = -2;
        scene.add(key);
        const accentLight = new T.PointLight(palette.accent[appearanceRef.current.accent], 8, 10);
        accentLight.position.set(-2.6, 2.1, 1.6);
        scene.add(accentLight);
        const warm = new T.PointLight(0xffb66a, 2.2, 8);
        warm.position.set(2.6, 1.7, 1.8);
        scene.add(warm);
        addRoom(scene, appearanceRef.current);

        const loader = new GLTFLoader();
        loader.register((parser: any) => new VRMLoaderPlugin(parser));
        const gltf = await loadModel(loader);
        if (cancelled) return;
        const vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("VRM model missing");
        if (vrm?.meta?.metaVersion === "0") VRMUtils.rotateVRM0?.(vrm);
        VRMUtils?.removeUnnecessaryVertices?.(vrm.scene);
        VRMUtils?.combineSkeletons?.(vrm.scene);
        vrm.scene.traverse((object: any) => { object.castShadow = true; object.receiveShadow = true; });

        const bounds = new T.Box3().setFromObject(vrm.scene);
        const size = bounds.getSize(new T.Vector3());
        const center = bounds.getCenter(new T.Vector3());
        const uniformScale = 1.64 / Math.max(size.y, 0.001);
        vrm.scene.scale.setScalar(uniformScale);
        vrm.scene.position.set(-center.x * uniformScale, -bounds.min.y * uniformScale, -center.z * uniformScale);
        scene.add(vrm.scene);

        const runtime: Runtime = { vrm, accentLight, modelBaseScale: new T.Vector3(uniformScale, uniformScale, uniformScale) };
        runtimeRef.current = runtime;
        applyAppearance(runtime, appearanceRef.current);
        const pose = capture(vrm);

        let zone: CompanionZone = "center";
        let x = getCompanionZonePosition("center").x;
        let z = getCompanionZonePosition("center").z;
        let tx = x;
        let tz = z;
        let action: Action = "idle";
        let phase: "travel" | "act" = "act";
        let started = performance.now() / 1000;
        let until = started + 2;
        let actDuration = 2;
        let yaw = 0;
        let mouseX = 0;
        let mouseY = 0;
        let lastAppearanceKey = "";

        const beginAct = (now: number) => {
          phase = "act";
          started = now;
          until = now + actDuration;
          setAction(action);
        };

        const choose = (now: number) => {
          const p = propsRef.current;
          if (p.state !== "idle") {
            action = p.state === "thinking" ? "think" : p.state === "listening" ? "wave" : "idle";
            actDuration = 2;
            tx = x;
            tz = z;
            beginAct(now);
            return;
          }
          const decision = decideCompanionLife(new Date(), p.mood);
          const target = getCompanionZonePosition(decision.zone);
          zone = decision.zone;
          action = decision.action;
          actDuration = decision.durationMs / 1000;
          tx = target.x;
          tz = target.z;
          if (Math.hypot(tx - x, tz - z) > 0.12) {
            phase = "travel";
            started = now;
            until = now + 30;
            setAction("walk");
          } else {
            beginAct(now);
          }
        };

        const onPointer = (event: PointerEvent) => {
          mouseX = (event.clientX / Math.max(innerWidth, 1)) * 2 - 1;
          mouseY = (event.clientY / Math.max(innerHeight, 1)) * 2 - 1;
        };
        const resize = () => {
          const nextWidth = Math.max(mount.clientWidth, 1);
          const nextHeight = Math.max(mount.clientHeight, 1);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight, false);
        };
        addEventListener("pointermove", onPointer, { passive: true });
        addEventListener("resize", resize);
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);

        choose(performance.now() / 1000);
        setVrmReady(true);

        let previous = performance.now();
        const frame = (ms: number) => {
          if (cancelled) return;
          const now = ms / 1000;
          const dt = Math.min((ms - previous) / 1000, 0.05);
          previous = ms;

          const currentAppearance = appearanceRef.current;
          const appearanceKey = JSON.stringify(currentAppearance);
          if (appearanceKey !== lastAppearanceKey) { lastAppearanceKey = appearanceKey; applyAppearance(runtime, currentAppearance); }

          const walking = phase === "travel";
          if (walking) {
            const dx = tx - x;
            const dz = tz - z;
            const distance = Math.hypot(dx, dz);
            if (distance > 0.06) {
              const step = Math.min(1.05 * dt, distance);
              x += (dx / distance) * step;
              z += (dz / distance) * step;
              yaw = Math.atan2(dx, dz);
            } else {
              x = tx;
              z = tz;
              beginAct(now);
            }
          } else if (now >= until) {
            choose(now);
          }

          const currentAction: Action = phase === "travel" ? "walk" : action;
          const seated = currentAction === "sit" || currentAction === "work" || currentAction === "sleep";
          const seatY = seated ? SEAT_HEIGHT[zone] ?? 0 : 0;
          x = clamp(x, -2.8, 2.8);
          z = clamp(z, -1.15, 1.1);
          vrm.scene.position.x = x;
          vrm.scene.position.z = z;

          const phaseT = clamp((now - started) / Math.max(until - started, 0.01), 0, 1);
          if (currentAction === "jump") {
            vrm.scene.position.y = seatY + Math.abs(Math.sin((now - started) * 2.6)) * 0.35;
            vrm.scene.rotation.x = 0;
          } else if (currentAction === "flip") {
            vrm.scene.position.y = seatY + Math.sin(phaseT * Math.PI) * 0.5;
            vrm.scene.rotation.x = phaseT * Math.PI * 2;
          } else {
            vrm.scene.position.y = seatY;
            vrm.scene.rotation.x = 0;
          }

          const targetYaw = phase === "travel" ? yaw : currentAction === "spin" ? ZONE_YAW[zone] + phaseT * Math.PI * 4 : currentAction === "wave" ? 0 : ZONE_YAW[zone];
          if (currentAction === "spin") vrm.scene.rotation.y = targetYaw;
          else vrm.scene.rotation.y += clamp(targetYaw - vrm.scene.rotation.y, -0.08, 0.08);

          animate(vrm, pose, currentAction, now - started, propsRef.current.level, propsRef.current.mood);
          if (pose.head?.bone && !seated) {
            pose.head.bone.rotation.y += clamp(mouseX * 0.22, -0.22, 0.22);
            pose.head.bone.rotation.x += clamp(-mouseY * 0.08, -0.08, 0.08);
          }
          if (propsRef.current.state === "speaking") expression(vrm, "aa", Math.min(1, 0.18 + propsRef.current.level * 0.9));
          vrm.update?.(dt);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        disposeScene = () => {
          resizeObserver.disconnect();
          removeEventListener("pointermove", onPointer);
          removeEventListener("resize", resize);
          runtimeRef.current = null;
          renderer.dispose();
          renderer.domElement.remove();
          scene.traverse((object: any) => {
            object.geometry?.dispose?.();
            const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
            materials.forEach((material: any) => material.dispose?.());
          });
        };
      } catch (error) {
        console.error("JARVIS 3D model failed", error);
        runtimeRef.current = null;
        setVrmReady(false);
        if (!cancelled) fallbackOnly();
      }
    };

    void boot();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      disposeScene?.();
    };
  }, []);

  const stateAction: Action = state === "thinking" ? "think" : state === "listening" ? "wave" : fallbackAction;
  return <div ref={mountRef} className="jarvis-3d-layer">{!vrmReady && visibleFallback(stateAction, state, mood, liveAppearance)}</div>;
}
