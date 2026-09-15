import { useEffect, useRef, useState } from "react";
import type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";
export type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

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
  onAsk?: (question: string) => void;
  onActivity?: (activity: string) => void;
};

type Action = "idle" | "walk" | "sit" | "work" | "sleep" | "stretch" | "dance" | "spin" | "jump" | "flip" | "wave" | "think";

const MODEL_URL = "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/fem_vroid.vrm";
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const ACTION_LABEL: Record<Action, string> = {
  idle: "Jen tak odpočívá",
  walk: "Prochází se po pokoji",
  sit: "Sedí a relaxuje",
  work: "Pracuje u svého stolu",
  sleep: "Spí",
  stretch: "Protahuje se",
  dance: "Tancuje",
  spin: "Točí se pro zábavu",
  jump: "Skáče",
  flip: "Dělá salto",
  wave: "Mává na tebe",
  think: "Přemýšlí",
};

function getBone(vrm: any, name: string) {
  return vrm?.humanoid?.getNormalizedBoneNode?.(name) ?? null;
}

function snapshotPose(vrm: any, names: string[]) {
  const result: Record<string, any> = {};
  for (const name of names) {
    const bone = getBone(vrm, name);
    if (bone) result[name] = { bone, q: bone.quaternion.clone() };
  }
  return result;
}

function resetPose(pose: Record<string, any>) {
  Object.values(pose).forEach(({ bone, q }: any) => bone.quaternion.copy(q));
}

function rotateBone(pose: Record<string, any>, name: string, x = 0, y = 0, z = 0) {
  const item = pose[name];
  const T = window.THREE;
  if (!item || !T) return;
  item.bone.quaternion.copy(item.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(x, y, z)));
}

function setExpression(vrm: any, name: string, value: number) {
  try {
    vrm?.expressionManager?.setValue?.(name, clamp(value, 0, 1));
  } catch {
    // VRM expression names are model dependent.
  }
}

function animateRig(vrm: any, pose: Record<string, any>, action: Action, t: number, level: number, mood: AvatarMood) {
  resetPose(pose);
  const walk = Math.sin(t * 7);
  const walkOpposite = Math.sin(t * 7 + Math.PI);
  const breathe = Math.sin(t * 2.1) * 0.028;
  const slow = Math.sin(t * 1.4);

  if (pose.hips?.bone) pose.hips.bone.position.y = breathe;
  rotateBone(pose, "chest", 0, 0, breathe * 0.5);

  if (action === "walk") {
    rotateBone(pose, "leftUpperLeg", walk * 0.62);
    rotateBone(pose, "rightUpperLeg", walkOpposite * 0.62);
    rotateBone(pose, "leftLowerLeg", Math.max(0, -walk) * 0.55);
    rotateBone(pose, "rightLowerLeg", Math.max(0, -walkOpposite) * 0.55);
    rotateBone(pose, "leftFoot", Math.max(0, -walk) * 0.16);
    rotateBone(pose, "rightFoot", Math.max(0, -walkOpposite) * 0.16);
    rotateBone(pose, "leftUpperArm", walkOpposite * 0.42);
    rotateBone(pose, "rightUpperArm", walk * 0.42);
    rotateBone(pose, "spine", Math.sin(t * 3.5) * 0.025);
  } else if (action === "wave") {
    rotateBone(pose, "rightUpperArm", -1.05, 0, -0.48);
    rotateBone(pose, "rightLowerArm", -0.22, 0, -0.92 + Math.sin(t * 10) * 0.24);
    rotateBone(pose, "head", Math.sin(t * 2) * 0.04, 0, 0.04);
  } else if (action === "sit" || action === "work") {
    rotateBone(pose, "leftUpperLeg", -1.18);
    rotateBone(pose, "rightUpperLeg", -1.18);
    rotateBone(pose, "leftLowerLeg", 1.2);
    rotateBone(pose, "rightLowerLeg", 1.2);
    rotateBone(pose, "leftFoot", -0.12);
    rotateBone(pose, "rightFoot", -0.12);
    rotateBone(pose, "spine", action === "work" ? -0.28 : -0.18);
    rotateBone(pose, "chest", action === "work" ? -0.14 : -0.08);
    if (action === "work") {
      rotateBone(pose, "leftUpperArm", -0.62, 0, 0.16);
      rotateBone(pose, "rightUpperArm", -0.62, 0, -0.16);
      rotateBone(pose, "leftLowerArm", -0.46, 0, 0.06);
      rotateBone(pose, "rightLowerArm", -0.46, 0, -0.06);
      rotateBone(pose, "head", 0.10, Math.sin(t * 0.7) * 0.07, 0);
    }
    if (mood === "sleep" || action === "sleep") rotateBone(pose, "head", 0.22, 0, 0.16);
  } else if (action === "sleep") {
    rotateBone(pose, "leftUpperLeg", -0.9);
    rotateBone(pose, "rightUpperLeg", -0.88);
    rotateBone(pose, "leftLowerLeg", 1.02);
    rotateBone(pose, "rightLowerLeg", 1.04);
    rotateBone(pose, "spine", -0.12);
    rotateBone(pose, "head", 0.25, 0, 0.20);
  } else if (action === "stretch") {
    const k = Math.sin(t * 2.4);
    rotateBone(pose, "leftUpperArm", -0.95 + k * 0.08, 0, 0.35);
    rotateBone(pose, "rightUpperArm", -0.95 + k * 0.08, 0, -0.35);
    rotateBone(pose, "leftLowerArm", -0.35, 0, 0.28);
    rotateBone(pose, "rightLowerArm", -0.35, 0, -0.28);
    rotateBone(pose, "chest", -0.10, 0, Math.sin(t * 1.2) * 0.04);
  } else if (action === "dance") {
    const sway = Math.sin(t * 5.5);
    rotateBone(pose, "leftUpperLeg", sway * 0.28);
    rotateBone(pose, "rightUpperLeg", -sway * 0.28);
    rotateBone(pose, "leftUpperArm", -0.7 + sway * 0.30, 0, 0.24);
    rotateBone(pose, "rightUpperArm", -0.7 - sway * 0.30, 0, -0.24);
    rotateBone(pose, "chest", 0, 0, sway * 0.08);
    rotateBone(pose, "head", 0, sway * 0.08, 0);
  } else if (action === "jump") {
    const k = Math.sin(clamp(t / 1.15, 0, 1) * Math.PI);
    rotateBone(pose, "leftUpperLeg", -0.28 * k);
    rotateBone(pose, "rightUpperLeg", 0.28 * k);
    rotateBone(pose, "leftLowerLeg", 0.72 * k);
    rotateBone(pose, "rightLowerLeg", 0.72 * k);
    rotateBone(pose, "leftUpperArm", 0.58 * k, 0, 0.12 * k);
    rotateBone(pose, "rightUpperArm", 0.58 * k, 0, -0.12 * k);
  } else if (action === "flip") {
    rotateBone(pose, "leftUpperArm", 0.7);
    rotateBone(pose, "rightUpperArm", 0.7);
    rotateBone(pose, "leftUpperLeg", 0.28);
    rotateBone(pose, "rightUpperLeg", -0.28);
    rotateBone(pose, "head", -0.18);
  } else if (action === "think") {
    rotateBone(pose, "rightUpperArm", -0.55, 0, -0.20);
    rotateBone(pose, "rightLowerArm", 0.30, 0, -0.45);
    rotateBone(pose, "head", 0.05, 0.12 + slow * 0.04, -0.05);
  } else if (action === "idle") {
    rotateBone(pose, "head", Math.sin(t * 0.9) * 0.045, 0, Math.sin(t * 0.7) * 0.03);
    rotateBone(pose, "leftUpperArm", Math.sin(t * 0.8) * 0.02, 0, 0.03);
    rotateBone(pose, "rightUpperArm", Math.sin(t * 0.8 + Math.PI) * 0.02, 0, -0.03);
  }

  if (action === "spin") {
    rotateBone(pose, "chest", 0, t * 3.8, 0);
  }

  const sleeping = action === "sleep" || mood === "sleep";
  setExpression(vrm, "blink", sleeping ? 1 : Math.sin(t * 0.72) > 0.985 ? 1 : 0);
  setExpression(vrm, "aa", level > 0.03 ? Math.min(1, 0.14 + level * 0.9) : 0);
  setExpression(vrm, "happy", mood === "play" || action === "dance" ? 0.7 : mood === "curious" ? 0.2 : 0);
  setExpression(vrm, "relaxed", sleeping ? 0.55 : mood === "bored" ? 0.15 : 0);
}

function makeBox(T: any, scene: any, size: [number, number, number], position: [number, number, number], opacity = 0.7, emissive = 0x0a1523) {
  const geometry = new T.BoxGeometry(...size);
  const material = new T.MeshStandardMaterial({ color: 0x16283a, roughness: 0.72, metalness: 0.28, transparent: true, opacity, emissive, emissiveIntensity: 0.35 });
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function JarvisCompanion({ state, mood, level, onActivity }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ state, mood, level });
  const activityRef = useRef(onActivity);
  const [activity, setActivity] = useState("Probouzí se…");

  useEffect(() => {
    propsRef.current = { state, mood, level };
  }, [state, mood, level]);

  useEffect(() => {
    activityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let timeout = 0;
    let raf = 0;
    let cleanup = () => undefined;

    const announce = (next: string) => {
      setActivity(next);
      activityRef.current?.(next);
    };

    const boot = async () => {
      if (cancelled) return;
      if (!window.THREE || !window.THREE_GLTFLoader || !window.THREE_VRM) {
        timeout = window.setTimeout(boot, 100);
        return;
      }

      const T = window.THREE;
      const { GLTFLoader } = window.THREE_GLTFLoader;
      const { VRMLoaderPlugin, VRMUtils } = window.THREE_VRM;
      const scene = new T.Scene();
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const camera = new T.PerspectiveCamera(24, width / height, 0.01, 100);
      camera.position.set(0, 2.15, 7.2);
      camera.lookAt(0, 1.45, 0);

      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "jarvis-3d-canvas";
      mount.appendChild(renderer.domElement);

      scene.add(new T.HemisphereLight(0xbfe8ff, 0x06111d, 1.85));
      const key = new T.DirectionalLight(0xffffff, 3.1);
      key.position.set(-3.5, 6.5, 4.8);
      key.castShadow = true;
      scene.add(key);
      const cyan = new T.PointLight(0x22ddff, 11, 13);
      cyan.position.set(-3.8, 3.0, 1.6);
      scene.add(cyan);
      const warm = new T.PointLight(0xffb765, 4.2, 10);
      warm.position.set(3.2, 2.0, 2.8);
      scene.add(warm);

      const floor = new T.Mesh(
        new T.PlaneGeometry(8.5, 4.8),
        new T.MeshStandardMaterial({ color: 0x0b1520, roughness: 0.86, metalness: 0.10, transparent: true, opacity: 0.82 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.01;
      floor.receiveShadow = true;
      scene.add(floor);

      const backWall = makeBox(T, scene, [8.5, 4.5, 0.16], [0, 2.2, -1.65], 0.52, 0x07131f);
      const leftWall = makeBox(T, scene, [0.16, 4.5, 3.5], [-4.1, 2.2, 0], 0.34, 0x07131f);
      const rightWall = makeBox(T, scene, [0.16, 4.5, 3.5], [4.1, 2.2, 0], 0.34, 0x07131f);
      backWall.receiveShadow = true;
      leftWall.receiveShadow = true;
      rightWall.receiveShadow = true;

      makeBox(T, scene, [2.25, 0.62, 0.95], [1.85, 0.32, -0.50], 0.72, 0x0b2032);
      makeBox(T, scene, [2.25, 0.95, 0.16], [1.85, 0.98, -0.48], 0.56, 0x102d3d);
      makeBox(T, scene, [1.75, 0.12, 0.85], [-1.85, 1.34, -0.42], 0.82, 0x0b2032);
      makeBox(T, scene, [0.14, 0.70, 0.14], [-2.60, 0.95, -0.42], 0.85, 0x0b2032);
      makeBox(T, scene, [0.14, 0.70, 0.14], [-1.10, 0.95, -0.42], 0.85, 0x0b2032);
      makeBox(T, scene, [1.20, 0.08, 0.58], [-1.85, 1.76, -0.44], 0.62, 0x0f2334);
      makeBox(T, scene, [0.64, 0.04, 0.12], [-1.85, 1.94, -0.38], 0.66, 0x18abc7);
      makeBox(T, scene, [0.12, 0.48, 0.12], [1.15, 0.58, -0.54], 0.62, 0x0d2637);
      makeBox(T, scene, [0.95, 0.06, 0.55], [1.15, 0.84, -0.54], 0.70, 0x0f2334);

      const lamp = new T.Mesh(new T.CylinderGeometry(0.16, 0.26, 0.38, 24), new T.MeshStandardMaterial({ color: 0x182b3b, metalness: 0.3, roughness: 0.6, emissive: 0x4b2a12, emissiveIntensity: 1 }));
      lamp.position.set(2.75, 1.55, -0.45);
      scene.add(lamp);
      const lampLight = new T.PointLight(0xffba68, 2.6, 4.2);
      lampLight.position.set(2.75, 1.72, -0.45);
      scene.add(lampLight);

      const plant = new T.Group();
      plant.position.set(-3.0, 0, -0.72);
      const pot = new T.Mesh(new T.CylinderGeometry(0.22, 0.30, 0.42, 18), new T.MeshStandardMaterial({ color: 0x243746, roughness: 0.85 }));
      pot.position.y = 0.21;
      plant.add(pot);
      for (let i = 0; i < 7; i += 1) {
        const leaf = new T.Mesh(new T.SphereGeometry(0.16, 14, 10), new T.MeshStandardMaterial({ color: 0x1d6b72, roughness: 0.86, transparent: true, opacity: 0.85 }));
        const angle = (Math.PI * 2 * i) / 7;
        leaf.position.set(Math.cos(angle) * 0.24, 0.58 + (i % 2) * 0.16, Math.sin(angle) * 0.18);
        leaf.scale.set(0.7, 1.45, 0.55);
        plant.add(leaf);
      }
      scene.add(plant);

      const loader = new GLTFLoader();
      loader.register((parser: any) => new VRMLoaderPlugin(parser));

      try {
        announce("Načítá svůj pokoj…");
        const gltf = await new Promise<any>((resolve, reject) => loader.load(MODEL_URL, resolve, undefined, reject));
        if (cancelled) return;
        const vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("VRM model missing");

        VRMUtils.removeUnnecessaryVertices?.(vrm.scene);
        VRMUtils.combineSkeletons?.(vrm.scene);
        vrm.scene.traverse((object: any) => {
          object.castShadow = true;
          object.receiveShadow = true;
        });

        const box = new T.Box3().setFromObject(vrm.scene);
        const size = box.getSize(new T.Vector3());
        const center = box.getCenter(new T.Vector3());
        const scale = 2.38 / Math.max(size.y, 0.001);
        vrm.scene.scale.setScalar(scale);
        vrm.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        scene.add(vrm.scene);

        const pose = snapshotPose(vrm, [
          "hips", "spine", "chest", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm",
          "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg", "leftFoot", "rightFoot",
        ]);

        let x = 0;
        let z = 0;
        let targetX = 0;
        let targetZ = 0;
        let yaw = 0;
        let action: Action = "idle";
        let started = performance.now() / 1000;
        let until = started + 2.6;
        let mx = 0;
        let my = 0;
        let nextLifeCheck = started + 8;

        const hour = () => new Date().getHours();
        const choose = (now: number) => {
          const p = propsRef.current;
          if (p.state !== "idle") {
            action = "idle";
            started = now;
            until = now + 0.35;
            return;
          }

          const currentHour = hour();
          const sleepingHours = currentHour >= 1 && currentHour < 7;
          let pool: Action[];
          if (sleepingHours || p.mood === "sleep") {
            pool = ["sleep", "sleep", "sit", "idle"];
          } else if (p.mood === "play") {
            pool = ["dance", "walk", "jump", "spin", "flip", "wave", "stretch"];
          } else if (p.mood === "bored") {
            pool = ["walk", "sit", "think", "stretch", "wave", "dance"];
          } else if (p.mood === "curious") {
            pool = ["walk", "think", "wave", "stretch", "spin"];
          } else {
            pool = currentHour >= 9 && currentHour <= 18
              ? ["work", "work", "walk", "sit", "stretch", "think", "wave"]
              : ["walk", "sit", "stretch", "think", "wave", "dance"];
          }

          action = pool[Math.floor(Math.random() * pool.length)] || "idle";
          started = now;
          until = now + (
            action === "walk" ? 4.2 + Math.random() * 3.2 :
            action === "work" ? 6 + Math.random() * 4.0 :
            action === "sleep" ? 7 + Math.random() * 7 :
            action === "dance" ? 4.5 :
            action === "stretch" ? 3.0 :
            action === "flip" ? 1.7 :
            action === "jump" ? 1.25 :
            action === "sit" ? 5 + Math.random() * 4 :
            1.8 + Math.random() * 2.4
          );

          if (action === "work") {
            targetX = -1.85 + (Math.random() - 0.5) * 0.32;
            targetZ = -0.52;
          } else if (action === "sit" || action === "sleep") {
            targetX = 1.72 + (Math.random() - 0.5) * 0.34;
            targetZ = -0.25;
          } else if (action === "walk") {
            const destination = Math.random();
            targetX = destination < 0.38 ? -1.8 + Math.random() * 1.2 : destination < 0.76 ? 0.2 + Math.random() * 1.8 : -2.4 + Math.random() * 4.6;
            targetZ = -0.85 + Math.random() * 1.55;
          } else {
            targetX = clamp(x + (Math.random() - 0.5) * 1.6, -2.65, 2.65);
            targetZ = clamp(z + (Math.random() - 0.5) * 1.3, -0.82, 0.72);
          }

          if (action === "jump" || action === "flip") {
            targetX = clamp(x + (Math.random() - 0.5) * 0.8, -2.45, 2.45);
            targetZ = clamp(z + (Math.random() - 0.5) * 0.6, -0.62, 0.62);
          }

          announce(ACTION_LABEL[action]);
        };

        const onPointer = (event: PointerEvent) => {
          mx = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
          my = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
        };

        const onResize = () => {
          const nextWidth = Math.max(mount.clientWidth, 1);
          const nextHeight = Math.max(mount.clientHeight, 1);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight, false);
        };

        window.addEventListener("pointermove", onPointer, { passive: true });
        window.addEventListener("resize", onResize);
        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(mount);
        choose(performance.now() / 1000);

        let previous = performance.now();
        const frame = (ms: number) => {
          if (cancelled) return;
          const current = ms / 1000;
          const dt = Math.min((ms - previous) / 1000, 0.05);
          previous = ms;
          const p = propsRef.current;

          if (current >= until) choose(current);

          if (action === "walk" || action === "sit" || action === "work" || action === "sleep") {
            const dx = targetX - x;
            const dz = targetZ - z;
            const distance = Math.hypot(dx, dz);
            if (distance > 0.035) {
              const speed = action === "work" || action === "sit" || action === "sleep" ? 0.72 : 0.98;
              const step = Math.min(speed * dt, distance);
              x += (dx / distance) * step;
              z += (dz / distance) * step;
              yaw = Math.atan2(dx, dz);
            }
          }

          if (action === "jump") {
            vrm.scene.position.y = Math.sin(clamp((current - started) / 1.15, 0, 1) * Math.PI) * 0.42;
          } else if (action === "flip") {
            const phase = clamp((current - started) / 1.7, 0, 1);
            vrm.scene.position.y = Math.sin(phase * Math.PI) * 0.30;
            vrm.scene.rotation.x = phase * Math.PI * 2;
          } else {
            vrm.scene.position.y = 0;
            vrm.scene.rotation.x = 0;
          }

          x = clamp(x, -2.75, 2.75);
          z = clamp(z, -0.92, 0.92);
          vrm.scene.position.x = x;
          vrm.scene.position.z = z;

          if (action === "spin") {
            const phase = clamp((current - started) / Math.max(until - started, 0.01), 0, 1);
            vrm.scene.rotation.y = yaw + phase * Math.PI * 2;
          } else {
            const yawDelta = clamp(yaw - vrm.scene.rotation.y, -0.11, 0.11);
            vrm.scene.rotation.y += yawDelta;
          }

          animateRig(vrm, pose, action, current - started, p.level, p.mood);

          if (pose.head?.bone) {
            pose.head.bone.rotation.y = clamp(mx * 0.22, -0.22, 0.22);
            pose.head.bone.rotation.x += clamp(-my * 0.07, -0.07, 0.07);
          }
          if (p.state === "speaking") setExpression(vrm, "aa", Math.min(1, 0.18 + p.level * 0.9));

          // A tiny amount of autonomous room ambience makes the scene feel inhabited.
          if (current >= nextLifeCheck) {
            nextLifeCheck = current + 10 + Math.random() * 10;
            if (p.state === "idle" && Math.random() < 0.42) {
              const ambient = ["Kontroluje svůj pokoj", "Kouká z okna", "Hledá, co by mohla dělat", "Urovnává si věci", "Odpočívá po svém"];
              announce(ambient[Math.floor(Math.random() * ambient.length)] || "Odpočívá");
            }
          }

          vrm.update?.(dt);
          floor.material.opacity = 0.70 + Math.sin(current * 1.7) * 0.07;
          plant.rotation.y = Math.sin(current * 0.35) * 0.025;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);
        cleanup = () => {
          cancelAnimationFrame(raf);
          resizeObserver.disconnect();
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("resize", onResize);
          renderer.dispose();
          renderer.domElement.remove();
          scene.traverse((object: any) => {
            object.geometry?.dispose?.();
            const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
            materials.forEach((material: any) => material.dispose?.());
          });
        };
      } catch (error) {
        console.error("JARVIS VRM load failed", error);
        announce("Čeká na 3D postavu…");
        const fallback = document.createElement("div");
        fallback.className = "jarvis-3d-fallback";
        fallback.textContent = "3D avatar se načítá…";
        mount.appendChild(fallback);
        cleanup = () => fallback.remove();
      }
    };

    void boot();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cleanup();
    };
  }, []);

  return (
    <div ref={mountRef} className="jarvis-3d-layer" aria-label="Autonomní 3D postava Jarvise v jeho vlastním pokoji">
      <div className="jarvis-life-badge" aria-live="polite">
        <span className="jarvis-life-dot" />
        <span>{activity}</span>
      </div>
      <div className="jarvis-life-time">{new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
}
