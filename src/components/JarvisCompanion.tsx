import { useEffect, useRef } from "react";
import type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";
export type { AvatarMood, AvatarState } from "./JarvisCompanionTypes";

declare global {
  interface Window {
    THREE?: any;
    THREE_GLTFLoader?: any;
    THREE_VRM?: any;
  }
}

type Props = { state: AvatarState; mood: AvatarMood; level: number; onAsk?: (question: string) => void };
type Action = "idle" | "walk" | "sit" | "spin" | "jump" | "flip" | "wave";

const MODEL_URL = "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/fem_vroid.vrm";
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const E = Math.E;

function useBone(vrm: any, name: string) {
  return vrm?.humanoid?.getNormalizedBoneNode?.(name) ?? null;
}

function makePose(vrm: any, names: string[]) {
  return names.reduce<Record<string, any>>((acc, name) => {
    const bone = useBone(vrm, name);
    if (bone) acc[name] = { bone, q: bone.quaternion.clone() };
    return acc;
  }, {});
}

function resetPose(pose: Record<string, any>) {
  Object.values(pose).forEach(({ bone, q }: any) => bone.quaternion.copy(q));
}

function rotateBone(pose: Record<string, any>, name: string, x: number, y = 0, z = 0, amount = 1) {
  const item = pose[name];
  if (!item) return;
  const THREE = window.THREE;
  const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(x * amount, y * amount, z * amount));
  item.bone.quaternion.copy(item.q).multiply(extra);
}

function expression(vrm: any, name: string, value: number) {
  const manager = vrm?.expressionManager;
  if (!manager?.setValue) return;
  try { manager.setValue(name, clamp(value, 0, 1)); } catch {}
}

function applyAction(vrm: any, pose: Record<string, any>, action: Action, t: number, level: number, mood: AvatarMood) {
  resetPose(pose);
  const w = Math.sin(t * 7);
  const w2 = Math.sin(t * 7 + Math.PI);
  const breathe = Math.sin(t * 2.2) * 0.035;
  const head = pose.head?.bone;
  const hips = pose.hips?.bone;
  const chest = pose.chest?.bone;
  if (hips) hips.position.y = breathe * 0.45;
  if (chest) rotateBone(pose, "chest", 0, 0, breathe * 0.8);

  if (action === "walk") {
    rotateBone(pose, "leftUpperLeg", w * 0.72);
    rotateBone(pose, "rightUpperLeg", w2 * 0.72);
    rotateBone(pose, "leftLowerLeg", Math.max(0, -w) * 0.55);
    rotateBone(pose, "rightLowerLeg", Math.max(0, -w2) * 0.55);
    rotateBone(pose, "leftFoot", Math.max(0, -w) * 0.18);
    rotateBone(pose, "rightFoot", Math.max(0, -w2) * 0.18);
    rotateBone(pose, "leftUpperArm", w2 * 0.45);
    rotateBone(pose, "rightUpperArm", w * 0.45);
    rotateBone(pose, "spine", Math.sin(t * 3.5) * 0.035);
  }
  if (action === "wave") {
    rotateBone(pose, "rightUpperArm", -0.9, 0, -0.42);
    rotateBone(pose, "rightLowerArm", -0.25, 0, -0.95);
  }
  if (action === "sit") {
    rotateBone(pose, "leftUpperLeg", -1.15);
    rotateBone(pose, "rightUpperLeg", -1.15);
    rotateBone(pose, "leftLowerLeg", 1.2);
    rotateBone(pose, "rightLowerLeg", 1.2);
    rotateBone(pose, "leftFoot", -0.15);
    rotateBone(pose, "rightFoot", -0.15);
    rotateBone(pose, "spine", -0.18);
    rotateBone(pose, "chest", -0.08);
    if (mood === "sleep") rotateBone(pose, "head", 0.2, 0, 0.14);
  }
  if (action === "jump") {
    const p = (t % 1.2) / 1.2;
    const k = Math.sin(p * Math.PI);
    rotateBone(pose, "leftUpperLeg", -0.25 * k);
    rotateBone(pose, "rightUpperLeg", 0.25 * k);
    rotateBone(pose, "leftLowerLeg", 0.7 * k);
    rotateBone(pose, "rightLowerLeg", 0.7 * k);
    rotateBone(pose, "leftUpperArm", 0.6 * k, 0, 0.1 * k);
    rotateBone(pose, "rightUpperArm", 0.6 * k, 0, -0.1 * k);
  }
  if (action === "flip") {
    rotateBone(pose, "spine", t * 5.9);
    rotateBone(pose, "leftUpperArm", 0.8);
    rotateBone(pose, "rightUpperArm", 0.8);
    rotateBone(pose, "leftUpperLeg", 0.35);
    rotateBone(pose, "rightUpperLeg", -0.35);
  }
  if (action === "spin") rotateBone(pose, "hips", 0, t * 3.8, 0);
  if (action === "idle") {
    rotateBone(pose, "head", Math.sin(t * 0.9) * 0.05, 0, Math.sin(t * 0.7) * 0.035);
    rotateBone(pose, "leftUpperArm", Math.sin(t * 0.8) * 0.025, 0, 0.04);
    rotateBone(pose, "rightUpperArm", Math.sin(t * 0.8 + Math.PI) * 0.025, 0, -0.04);
  }

  if (head) head.rotation.x += level * -0.03;
  expression(vrm, "blink", Math.max(0, Math.sin(t * 0.75) > 0.985 ? 1 : 0));
  expression(vrm, "aa", level > 0.03 ? Math.min(1, 0.15 + level * 0.9) : 0);
  expression(vrm, "happy", mood === "play" ? 0.65 : mood === "curious" ? 0.2 : 0);
  expression(vrm, "relaxed", mood === "sleep" ? 0.5 : 0);
}

export function JarvisCompanion({ state, mood, level }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ state, mood, level });

  useEffect(() => {
    propsRef.current = { state, mood, level };
  }, [state, mood, level]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let retry = 0;
    let raf = 0;
    let cleanup: (() => void) | undefined;

    const boot = async () => {
      if (cancelled) return;
      if (!window.THREE || !window.THREE_GLTFLoader || !window.THREE_VRM) {
        retry = window.setTimeout(boot, 100);
        return;
      }
      const THREE = window.THREE;
      const { GLTFLoader } = window.THREE_GLTFLoader;
      const { VRMLoaderPlugin, VRMUtils } = window.THREE_VRM;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(25, innerWidth / innerHeight, 0.01, 100);
      camera.position.set(0, 1.35, 5.8);
      camera.lookAt(0, 1.15, 0);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "jarvis-3d-canvas";
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xd9f6ff, 0x07111c, 2.3));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(3, 5, 4);
      key.castShadow = true;
      scene.add(key);
      const rim = new THREE.PointLight(0x15ddff, 10, 12);
      rim.position.set(-3, 2.4, 1.5);
      scene.add(rim);
      const warm = new THREE.PointLight(0xffbd66, 4.5, 9);
      warm.position.set(2.5, 2, 2);
      scene.add(warm);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 48),
        new THREE.MeshBasicMaterial({ color: 0x19caff, transparent: true, opacity: 0.1, depthWrite: false })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.scale.set(1, 0.42, 1);
      floor.position.y = 0.01;
      scene.add(floor);

      const loader = new GLTFLoader();
      loader.register((parser: any) => new VRMLoaderPlugin(parser));
      let vrm: any = null;
      try {
        const gltf = await new Promise<any>((resolve, reject) => loader.load(MODEL_URL, resolve, undefined, reject));
        if (cancelled) return;
        vrm = gltf.userData.vrm;
        if (!vrm) throw new Error("VRM model was not found in GLTF payload");
        VRMUtils.removeUnnecessaryVertices?.(vrm.scene);
        VRMUtils.combineSkeletons?.(vrm.scene);
        vrm.scene.traverse((obj: any) => { obj.castShadow = true; obj.receiveShadow = true; });

        const box = new THREE.Box3().setFromObject(vrm.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 3.65 / Math.max(size.y, 0.001);
        vrm.scene.scale.setScalar(scale);
        vrm.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        scene.add(vrm.scene);

        const boneNames = [
          "hips", "spine", "chest", "head", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm",
          "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg", "leftFoot", "rightFoot"
        ];
        const pose = makePose(vrm, boneNames);
        let x = 0, z = 0, targetX = 0, targetZ = 0;
        let action: Action = "idle";
        let actionStarted = performance.now() / 1000;
        let actionUntil = actionStarted + 2.3;
        let mouseX = 0, mouseY = 0;

        const chooseAction = (now: number) => {
          const p = propsRef.current;
          if (p.state !== "idle") { action = "idle"; actionStarted = now; actionUntil = now + 0.35; return; }
          const pool: Action[] = p.mood === "play"
            ? ["walk", "walk", "jump", "spin", "flip", "wave"]
            : p.mood === "bored" ? ["walk", "sit", "wave", "idle"]
            : p.mood === "sleep" ? ["sit", "sit", "idle"]
            : p.mood === "curious" ? ["walk", "wave", "spin", "idle"]
            : ["walk", "walk", "wave", "spin", "idle"];
          action = pool[Math.floor(Math.random() * pool.length)] ?? "idle";
          actionStarted = now;
          actionUntil = now + (action === "walk" ? 3.5 + Math.random() * 3 : action === "flip" ? 1.8 : action === "jump" ? 1.3 : 1.5 + Math.random() * 2);
          if (action === "walk") {
            targetX = clamp((Math.random() - 0.5) * 6.0, -2.55, 2.55);
            targetZ = clamp((Math.random() - 0.5) * 1.8, -0.8, 0.8);
          }
        };

        const onPointerMove = (e: PointerEvent) => {
          mouseX = e.clientX / Math.max(innerWidth, 1) * 2 - 1;
          mouseY = e.clientY / Math.max(innerHeight, 1) * 2 - 1;
        };
        const onResize = () => {
          camera.aspect = innerWidth / Math.max(innerHeight, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(innerWidth, innerHeight);
        };
        addEventListener("pointermove", onPointerMove, { passive: true });
        addEventListener("resize", onResize);
        chooseAction(performance.now() / 1000);

        let previous = performance.now();
        const loop = (ms: number) => {
          if (cancelled) return;
          const now = ms / 1000;
          const delta = Math.min((ms - previous) / 1000, 0.05);
          previous = ms;
          const p = propsRef.current;
          if (now >= actionUntil) chooseAction(now);
          if (action === "walk") {
            const dx = targetX - x, dz = targetZ - z, d = Math.hypot(dx, dz);
            if (d > 0.04) {
              const speed = 0.95 * delta;
              x += dx / d * Math.min(speed, d);
              z += dz / d * Math.min(speed, d);
              const yaw = Math.atan2(dx, dz);
              vrm.scene.rotation.y += clamp(yaw - vrm.scene.rotation.y, -0.12, 0.12);
            }
          }
          x = clamp(x, -2.7, 2.7); z = clamp(z, -0.95, 0.95);
          vrm.scene.position.x = x;
          vrm.scene.position.z = z;
          const elapsed = now - actionStarted;
          applyAction(vrm, pose, action, elapsed, p.level, p.mood);
          if (pose.head?.bone) {
            pose.head.bone.rotation.y = clamp(mouseX * 0.25, -0.25, 0.25);
            pose.head.bone.rotation.x += clamp(-mouseY * 0.1, -0.1, 0.1);
          }
          if (p.state === "speaking") expression(vrm, "aa", Math.min(1, 0.18 + p.level * 0.9));
          if (vrm.update) vrm.update(delta);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        cleanup = () => {
          cancelAnimationFrame(raf);
          clearTimeout(retry);
          removeEventListener("pointermove", onPointerMove);
          removeEventListener("resize", onResize);
          renderer.dispose();
          renderer.domElement.remove();
          scene.traverse((obj: any) => {
            obj.geometry?.dispose?.();
            const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
            mats.forEach((m: any) => m.dispose?.());
          });
        };
      } catch (error) {
        console.error("JARVIS 3D model failed", error);
        const msg = document.createElement("div");
        msg.className = "jarvis-3d-fallback";
        msg.textContent = "3D avatar se načítá…";
        mount.appendChild(msg);
        cleanup = () => { msg.remove(); renderer.dispose(); renderer.domElement.remove(); };
      }
    };

    boot();
    return () => { cancelled = true; clearTimeout(retry); cleanup?.(); };
  }, []);

  return <div ref={mountRef} className="jarvis-3d-layer" aria-label="Skutečná 3D postava Jarvise" />;
}
