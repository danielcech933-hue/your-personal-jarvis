import { useEffect, useRef, useState } from "react";
import { loadJarvisProfile, type JarvisAppearance } from "@/lib/jarvis-profile";
import {
  decideCompanionLife,
  getCompanionZonePosition,
  type CompanionAction,
  type CompanionMood,
} from "@/lib/companion-life";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export type AvatarMood = CompanionMood;

declare global {
  interface Window {
    THREE?: any;
    THREE_GLTFLoader?: any;
    THREE_VRM?: any;
  }
}

type Props = {
  state: AvatarState;
  mood: AvatarMood;
  level: number;
  appearance?: JarvisAppearance;
  onAsk?: (question: string) => void;
  onActivity?: (activity: string) => void;
};

type Action = CompanionAction;

const MODEL_URL = "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/fem_vroid.vrm";
const DEFAULT_APPEARANCE: JarvisAppearance = {
  style: "glamorous",
  hair: "silver",
  outfit: "midnight",
  accent: "cyan",
  height: 1,
  body: "athletic",
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const labels: Record<Action, string> = {
  idle: "Jen tak odpočívá",
  walk: "Prochází se po pokoji",
  sit: "Sedí a relaxuje",
  work: "Pracuje u svého stolu",
  sleep: "Spí na gauči",
  stretch: "Protahuje se",
  dance: "Tancuje",
  spin: "Točí se pro zábavu",
  jump: "Skáče",
  flip: "Dělá salto",
  wave: "Mává na tebe",
  think: "Přemýšlí",
};

const palette = {
  hair: { silver: 0xddebf7, black: 0x141a2a, violet: 0x9c75da, rose: 0xe28da7 },
  outfit: { midnight: 0x172b46, white: 0xcfd9e7, crimson: 0x6d1729 },
  accent: { cyan: 0x46e9ff, violet: 0xb28cff, rose: 0xff82bd },
};

function bone(vrm: any, name: string) {
  return vrm?.humanoid?.getNormalizedBoneNode?.(name) ?? null;
}

function capture(vrm: any) {
  const names = [
    "hips",
    "spine",
    "chest",
    "head",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
  ];
  const pose: Record<string, any> = {};
  for (const name of names) {
    const b = bone(vrm, name);
    if (b) pose[name] = { bone: b, q: b.quaternion.clone() };
  }
  return pose;
}

function rotate(pose: Record<string, any>, name: string, x = 0, y = 0, z = 0) {
  const entry = pose[name];
  const T = window.THREE;
  if (!entry || !T?.Quaternion || !T?.Euler) return;
  entry.bone.quaternion.copy(entry.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(x, y, z)));
}

function reset(pose: Record<string, any>) {
  for (const entry of Object.values(pose) as any[]) entry.bone.quaternion.copy(entry.q);
}

function expression(vrm: any, name: string, value: number) {
  try {
    vrm?.expressionManager?.setValue?.(name, clamp(value, 0, 1));
  } catch {}
}

function animate(vrm: any, pose: Record<string, any>, action: Action, t: number, level: number, mood: AvatarMood) {
  reset(pose);
  const s = Math.sin(t * 7);
  const o = -s;
  const slow = Math.sin(t * 1.25);

  if (action === "walk") {
    rotate(pose, "leftUpperLeg", s * 0.58);
    rotate(pose, "rightUpperLeg", o * 0.58);
    rotate(pose, "leftLowerLeg", Math.max(0, -s) * 0.52);
    rotate(pose, "rightLowerLeg", Math.max(0, -o) * 0.52);
    rotate(pose, "leftUpperArm", o * 0.38);
    rotate(pose, "rightUpperArm", s * 0.38);
  } else if (action === "wave") {
    rotate(pose, "rightUpperArm", -1.03, 0, -0.45);
    rotate(pose, "rightLowerArm", -0.2, 0, -0.9 + Math.sin(t * 10) * 0.22);
    rotate(pose, "head", Math.sin(t * 2) * 0.04, 0, 0.04);
  } else if (action === "sit" || action === "work") {
    rotate(pose, "leftUpperLeg", -1.12);
    rotate(pose, "rightUpperLeg", -1.12);
    rotate(pose, "leftLowerLeg", 1.18);
    rotate(pose, "rightLowerLeg", 1.18);
    rotate(pose, "spine", action === "work" ? -0.22 : -0.16);
    if (action === "work") {
      rotate(pose, "leftUpperArm", -0.58, 0, 0.16);
      rotate(pose, "rightUpperArm", -0.58, 0, -0.16);
      rotate(pose, "leftLowerArm", -0.42);
      rotate(pose, "rightLowerArm", -0.42);
      rotate(pose, "head", 0.08, slow * 0.07, 0);
    }
  } else if (action === "sleep") {
    rotate(pose, "leftUpperLeg", -0.86);
    rotate(pose, "rightUpperLeg", -0.84);
    rotate(pose, "leftLowerLeg", 1);
    rotate(pose, "rightLowerLeg", 1.02);
    rotate(pose, "spine", -0.12);
    rotate(pose, "head", 0.23, 0, 0.18);
  } else if (action === "stretch") {
    const k = Math.sin(t * 2.2);
    rotate(pose, "leftUpperArm", -0.92 + k * 0.08, 0, 0.34);
    rotate(pose, "rightUpperArm", -0.92 + k * 0.08, 0, -0.34);
    rotate(pose, "leftLowerArm", -0.32, 0, 0.22);
    rotate(pose, "rightLowerArm", -0.32, 0, -0.22);
  } else if (action === "dance") {
    const k = Math.sin(t * 5.4);
    rotate(pose, "leftUpperLeg", k * 0.24);
    rotate(pose, "rightUpperLeg", -k * 0.24);
    rotate(pose, "leftUpperArm", -0.68 + k * 0.28, 0, 0.22);
    rotate(pose, "rightUpperArm", -0.68 - k * 0.28, 0, -0.22);
    rotate(pose, "chest", 0, 0, k * 0.09);
    rotate(pose, "head", 0, k * 0.1, 0);
  } else if (action === "jump") {
    const k = Math.sin(clamp(t / 1.15, 0, 1) * Math.PI);
    rotate(pose, "leftUpperLeg", -0.28 * k);
    rotate(pose, "rightUpperLeg", 0.28 * k);
    rotate(pose, "leftLowerLeg", 0.68 * k);
    rotate(pose, "rightLowerLeg", 0.68 * k);
    rotate(pose, "leftUpperArm", 0.55 * k, 0, 0.12 * k);
    rotate(pose, "rightUpperArm", 0.55 * k, 0, -0.12 * k);
  } else if (action === "flip") {
    rotate(pose, "leftUpperArm", 0.68);
    rotate(pose, "rightUpperArm", 0.68);
    rotate(pose, "leftUpperLeg", 0.26);
    rotate(pose, "rightUpperLeg", -0.26);
  } else if (action === "think") {
    rotate(pose, "rightUpperArm", -0.52, 0, -0.18);
    rotate(pose, "rightLowerArm", 0.28, 0, -0.42);
    rotate(pose, "head", 0.04, 0.1 + slow * 0.04, -0.04);
  } else if (action === "idle") {
    rotate(pose, "head", Math.sin(t * 0.85) * 0.04, Math.sin(t * 0.55) * 0.025, Math.sin(t * 0.72) * 0.025);
  }

  const sleeping = mood === "sleep" || action === "sleep";
  expression(vrm, "blink", sleeping ? 1 : Math.sin(t * 0.72) > 0.985 ? 1 : 0);
  expression(vrm, "aa", level > 0.03 ? Math.min(1, 0.12 + level * 0.9) : 0);
  expression(vrm, "happy", mood === "play" || action === "dance" ? 0.72 : mood === "curious" ? 0.22 : 0);
  expression(vrm, "relaxed", sleeping ? 0.58 : mood === "bored" ? 0.14 : 0);
}

function visibleFallback(action: Action, a: JarvisAppearance) {
  return (
    <div
      className="jarvis-avatar-fallback"
      data-hair={a.hair}
      data-outfit={a.outfit}
      data-accent={a.accent}
      data-body={a.body}
      data-style={a.style}
      aria-label="Živá anime postava"
    >
      <div className="fallback-aura" />
      <div className="fallback-shadow" />
      <div className="fallback-character" data-action={action}>
        <div className="fallback-hair" />
        <div className="fallback-head">
          <span className="fallback-eye left" />
          <span className="fallback-eye right" />
          <span className="fallback-mouth" />
        </div>
        <div className="fallback-neck" />
        <div className="fallback-torso"><span className="fallback-core" /></div>
        <div className="fallback-arm left" />
        <div className="fallback-arm right" />
        <div className="fallback-waist" />
        <div className="fallback-skirt" />
        <div className="fallback-leg left" />
        <div className="fallback-leg right" />
      </div>
    </div>
  );
}

export function JarvisCompanion({ state, mood, level, appearance = DEFAULT_APPEARANCE, onActivity }: Props) {
  const loadedAppearance = loadJarvisProfile().appearance || appearance;
  const appearanceRef = useRef<JarvisAppearance>(appearance);
  const [liveAppearance, setLiveAppearance] = useState<JarvisAppearance>(appearance);
  const [vrmReady, setVrmReady] = useState(false);
  const [fallbackAction, setFallbackAction] = useState<Action>("idle");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ state, mood, level });
  const activityRef = useRef(onActivity);

  useEffect(() => {
    propsRef.current = { state, mood, level };
  }, [state, mood, level]);

  useEffect(() => {
    activityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    const next = appearance || loadedAppearance || DEFAULT_APPEARANCE;
    appearanceRef.current = next;
    setLiveAppearance(next);
  }, [appearance, loadedAppearance]);

  useEffect(() => {
    const handler = () => {
      const next = loadJarvisProfile().appearance || DEFAULT_APPEARANCE;
      appearanceRef.current = next;
      setLiveAppearance(next);
    };
    window.addEventListener("jarvis-profile-updated", handler);
    return () => window.removeEventListener("jarvis-profile-updated", handler);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let timer = 0;
    let raf = 0;

    const setAction = (action: Action) => {
      setFallbackAction(action);
      activityRef.current?.(labels[action]);
    };

    const fallbackOnly = () => {
      setVrmReady(false);
      let until = 0;

      const choose = (now: number) => {
        const p = propsRef.current;
        const action: Action = p.state !== "idle"
          ? p.state === "thinking" ? "think" : "wave"
          : decideCompanionLife(new Date(), p.mood).action;
        until = now + (action === "sleep" ? 7.5 : 2 + Math.random() * 3);
        setAction(action);
      };

      const frame = (now: number) => {
        if (cancelled) return;
        if (!until || now >= until) choose(now);
        raf = requestAnimationFrame(frame);
      };

      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    };

    const boot = async () => {
      if (cancelled) return;
      if (window.THREE?.__jarvisLoadError || window.THREE_GLTFLoader?.__jarvisLoadError || window.THREE_VRM?.__jarvisLoadError) {
        timer = window.setTimeout(() => void fallbackOnly(), 0);
        return;
      }
      if (!window.THREE || !window.THREE_GLTFLoader || !window.THREE_VRM) {
        timer = window.setTimeout(boot, 100);
        return;
      }

      const T = window.THREE;

      try {
        const { GLTFLoader } = window.THREE_GLTFLoader;
        const { VRMLoaderPlugin, VRMUtils } = window.THREE_VRM;
        const a = appearanceRef.current;
        const scene = new T.Scene();
        const width = Math.max(mount.clientWidth, 1);
        const height = Math.max(mount.clientHeight, 1);
        const camera = new T.PerspectiveCamera(25, width / height, 0.01, 100);
        camera.position.set(0, 1.7, 5.8);
        camera.lookAt(0, 1.2, 0);

        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.domElement.className = "jarvis-3d-canvas";
        mount.appendChild(renderer.domElement);

        scene.add(new T.HemisphereLight(0xd9f5ff, 0x07111b, 2.2));
        const key = new T.DirectionalLight(0xffffff, 3.4);
        key.position.set(-3, 6, 5);
        scene.add(key);
        const accent = new T.PointLight(palette.accent[a.accent], 12, 12);
        accent.position.set(-3, 2.7, 2);
        scene.add(accent);
        const warm = new T.PointLight(0xffb66a, 2.8, 9);
        warm.position.set(3, 1.7, 2);
        scene.add(warm);

        const loader = new GLTFLoader();
        loader.register((parser: any) => new VRMLoaderPlugin(parser));
        const gltf = await new Promise<any>((resolve, reject) => loader.load(MODEL_URL, resolve, undefined, reject));
        if (cancelled) return;

        const vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("VRM model missing");
        VRMUtils?.removeUnnecessaryVertices?.(vrm.scene);
        VRMUtils?.combineSkeletons?.(vrm.scene);
        vrm.scene.traverse((object: any) => {
          object.castShadow = true;
          object.receiveShadow = true;
        });

        const box = new T.Box3().setFromObject(vrm.scene);
        const size = box.getSize(new T.Vector3());
        const center = box.getCenter(new T.Vector3());
        const scale = 2.55 / Math.max(size.y, 0.001);
        const bodyScale = a.body === "slim" ? 0.94 : a.body === "curvy" ? 1.06 : 1;
        vrm.scene.scale.setScalar(scale * a.height);
        vrm.scene.scale.x *= bodyScale;
        vrm.scene.scale.z *= bodyScale;
        vrm.scene.position.set(-center.x * scale * a.height, -box.min.y * scale * a.height, -center.z * scale * a.height);
        scene.add(vrm.scene);

        vrm.scene.traverse((object: any) => {
          const raw = object.material;
          const materials = Array.isArray(raw) ? raw : raw ? [raw] : [];
          for (const material of materials) {
            const name = String(material.name || object.name || "").toLowerCase();
            if (name.includes("hair")) material.color?.setHex?.(palette.hair[a.hair]);
            if (/dress|cloth|skirt|top|outfit/.test(name)) material.color?.setHex?.(palette.outfit[a.outfit]);
            if (material.emissive?.setHex) material.emissive.setHex(palette.accent[a.accent]);
            if ("emissiveIntensity" in material) material.emissiveIntensity = a.style === "cyber" ? 0.14 : a.style === "glamorous" ? 0.06 : 0.025;
          }
        });

        const pose = capture(vrm);
        let x = 0;
        let z = 0.25;
        let tx = x;
        let tz = z;
        let action: Action = "idle";
        let started = performance.now() / 1000;
        let until = 0;
        let yaw = 0;
        let mouseX = 0;
        let mouseY = 0;

        const choose = (now: number) => {
          const p = propsRef.current;
          if (p.state !== "idle") {
            action = p.state === "thinking" ? "think" : p.state === "listening" ? "wave" : "idle";
            started = now;
            until = now + 1.8;
            tx = x;
            tz = z;
            setAction(action);
            return;
          }

          const decision = decideCompanionLife(new Date(), p.mood);
          const target = getCompanionZonePosition(decision.zone);
          action = decision.action;
          started = now;
          until = now + decision.durationMs / 1000;
          tx = target.x;
          tz = target.z;
          setAction(action);
        };

        const onPointer = (event: PointerEvent) => {
          mouseX = event.clientX / Math.max(innerWidth, 1) * 2 - 1;
          mouseY = event.clientY / Math.max(innerHeight, 1) * 2 - 1;
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

          if (now >= until) choose(now);

          const travelAction = action === "walk" || action === "work" || action === "sit" || action === "sleep";
          if (travelAction) {
            const dx = tx - x;
            const dz = tz - z;
            const distance = Math.hypot(dx, dz);
            if (distance > 0.03) {
              const speed = action === "work" ? 0.65 : action === "sleep" || action === "sit" ? 0.85 : 0.95;
              const step = Math.min(speed * dt, distance);
              x += dx / distance * step;
              z += dz / distance * step;
              yaw = Math.atan2(dx, dz);
            }
          }

          x = clamp(x, -2.45, 2.45);
          z = clamp(z, -0.9, 0.9);
          vrm.scene.position.x = x;
          vrm.scene.position.z = z;

          const phase = clamp((now - started) / Math.max(until - started, 0.01), 0, 1);
          if (action === "jump") {
            vrm.scene.position.y = Math.sin(clamp((now - started) / 1.15, 0, 1) * Math.PI) * 0.45;
          } else if (action === "flip") {
            vrm.scene.position.y = Math.sin(phase * Math.PI) * 0.32;
            vrm.scene.rotation.x = phase * Math.PI * 2;
          } else {
            vrm.scene.position.y = 0;
            vrm.scene.rotation.x = 0;
          }

          if (action === "spin") {
            vrm.scene.rotation.y = yaw + phase * Math.PI * 2;
          } else {
            const targetYaw = yaw + (action === "wave" ? Math.PI * 0.06 : 0);
            vrm.scene.rotation.y += clamp(targetYaw - vrm.scene.rotation.y, -0.09, 0.09);
          }

          animate(vrm, pose, action, now - started, propsRef.current.level, propsRef.current.mood);
          if (pose.head?.bone) {
            pose.head.bone.rotation.y = clamp(mouseX * 0.18, -0.18, 0.18);
            pose.head.bone.rotation.x += clamp(-mouseY * 0.06, -0.06, 0.06);
          }
          if (propsRef.current.state === "speaking") expression(vrm, "aa", Math.min(1, 0.18 + propsRef.current.level * 0.9));

          vrm.update?.(dt);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);

        return () => {
          cancelAnimationFrame(raf);
          resizeObserver.disconnect();
          removeEventListener("pointermove", onPointer);
          removeEventListener("resize", resize);
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
        setVrmReady(false);
        return fallbackOnly();
      }
    };

    void boot();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const stateAction: Action = state === "thinking" ? "think" : state === "idle" ? fallbackAction : state === "listening" ? "wave" : "idle";
  return <div ref={mountRef} className="jarvis-3d-layer">{!vrmReady && visibleFallback(stateAction, liveAppearance)}</div>;
}
