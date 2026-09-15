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

type Props = {
  state: AvatarState;
  mood: AvatarMood;
  level: number;
  onAsk?: (question: string) => void;
  onActivity?: (activity: string) => void;
};
type Action = "idle" | "walk" | "sit" | "spin" | "jump" | "flip" | "wave";

const MODEL_URL = "https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/fem_vroid.vrm";
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const ACTION_LABEL: Record<Action, string> = {
  idle: "Odpočívá",
  walk: "Prochází se po pokoji",
  sit: "Sedí a relaxuje",
  spin: "Točí se pro zábavu",
  jump: "Skáče",
  flip: "Dělá salto",
  wave: "Mává",
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
  if (!item) return;
  const T = window.THREE;
  item.bone.quaternion.copy(item.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(x, y, z)));
}

function setExpression(vrm: any, name: string, value: number) {
  try {
    vrm?.expressionManager?.setValue?.(name, clamp(value, 0, 1));
  } catch {
    // expression names differ across VRM models
  }
}

function animateRig(
  vrm: any,
  pose: Record<string, any>,
  action: Action,
  t: number,
  level: number,
  mood: AvatarMood,
) {
  resetPose(pose);
  const w = Math.sin(t * 7);
  const w2 = Math.sin(t * 7 + Math.PI);
  const breathe = Math.sin(t * 2.1) * 0.028;

  if (pose.hips?.bone) pose.hips.bone.position.y = breathe;
  rotateBone(pose, "chest", 0, 0, breathe * 0.5);

  if (action === "walk") {
    rotateBone(pose, "leftUpperLeg", w * 0.62);
    rotateBone(pose, "rightUpperLeg", w2 * 0.62);
    rotateBone(pose, "leftLowerLeg", Math.max(0, -w) * 0.55);
    rotateBone(pose, "rightLowerLeg", Math.max(0, -w2) * 0.55);
    rotateBone(pose, "leftFoot", Math.max(0, -w) * 0.16);
    rotateBone(pose, "rightFoot", Math.max(0, -w2) * 0.16);
    rotateBone(pose, "leftUpperArm", w2 * 0.42);
    rotateBone(pose, "rightUpperArm", w * 0.42);
    rotateBone(pose, "spine", Math.sin(t * 3.5) * 0.025);
  } else if (action === "wave") {
    rotateBone(pose, "rightUpperArm", -0.95, 0, -0.42);
    rotateBone(pose, "rightLowerArm", -0.22, 0, -0.9 + Math.sin(t * 10) * 0.24);
  } else if (action === "sit") {
    rotateBone(pose, "leftUpperLeg", -1.15);
    rotateBone(pose, "rightUpperLeg", -1.15);
    rotateBone(pose, "leftLowerLeg", 1.2);
    rotateBone(pose, "rightLowerLeg", 1.2);
    rotateBone(pose, "leftFoot", -0.12);
    rotateBone(pose, "rightFoot", -0.12);
    rotateBone(pose, "spine", -0.18);
    rotateBone(pose, "chest", -0.08);
    if (mood === "sleep") rotateBone(pose, "head", 0.18, 0, 0.13);
  } else if (action === "jump") {
    const k = Math.sin(((t % 1.15) / 1.15) * Math.PI);
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
  } else if (action === "idle") {
    rotateBone(pose, "head", Math.sin(t * 0.9) * 0.045, 0, Math.sin(t * 0.7) * 0.03);
    rotateBone(pose, "leftUpperArm", Math.sin(t * 0.8) * 0.02, 0, 0.03);
    rotateBone(pose, "rightUpperArm", Math.sin(t * 0.8 + Math.PI) * 0.02, 0, -0.03);
  }

  if (action === "spin") rotateBone(pose, "chest", 0, t * 3.8, 0);
  setExpression(vrm, "blink", Math.sin(t * 0.72) > 0.985 ? 1 : 0);
  setExpression(vrm, "aa", level > 0.03 ? Math.min(1, 0.14 + level * 0.9) : 0);
  setExpression(vrm, "happy", mood === "play" ? 0.7 : mood === "curious" ? 0.2 : 0);
  setExpression(vrm, "relaxed", mood === "sleep" ? 0.55 : 0);
}

export function JarvisCompanion({ state, mood, level, onActivity }: Props) {
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
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let timeout = 0;
    let raf = 0;
    let cleanup = () => undefined;

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
      const camera = new T.PerspectiveCamera(25, width / height, 0.01, 100);
      camera.position.set(0, 1.45, 5.35);
      camera.lookAt(0, 1.55, 0);

      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.domElement.className = "jarvis-3d-canvas";
      mount.appendChild(renderer.domElement);

      scene.add(new T.HemisphereLight(0xdff7ff, 0x07111b, 2.1));
      const key = new T.DirectionalLight(0xffffff, 3.5);
      key.position.set(3.5, 5.5, 4.5);
      key.castShadow = true;
      scene.add(key);
      const rim = new T.PointLight(0x22ddff, 12, 12);
      rim.position.set(-3.4, 2.8, 1.7);
      scene.add(rim);
      const warm = new T.PointLight(0xffb765, 3.8, 9);
      warm.position.set(2.8, 1.8, 2.4);
      scene.add(warm);

      const floor = new T.Mesh(
        new T.CircleGeometry(0.95, 64),
        new T.MeshBasicMaterial({ color: 0x42ddf4, transparent: true, opacity: 0.11, depthWrite: false }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.scale.set(1, 0.42, 1);
      floor.position.y = 0.01;
      scene.add(floor);

      const loader = new GLTFLoader();
      loader.register((parser: any) => new VRMLoaderPlugin(parser));

      try {
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
        const scale = 2.75 / Math.max(size.y, 0.001);
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
        let until = started + 2.4;
        let mx = 0;
        let my = 0;

        const choose = (now: number) => {
          const p = propsRef.current;
          if (p.state !== "idle") {
            action = "idle";
            started = now;
            until = now + 0.35;
            return;
          }

          const pool: Action[] =
            p.mood === "play"
              ? ["walk", "walk", "jump", "spin", "flip", "wave"]
              : p.mood === "bored"
                ? ["walk", "sit", "wave", "idle"]
                : p.mood === "sleep"
                  ? ["sit", "sit", "idle"]
                  : p.mood === "curious"
                    ? ["walk", "wave", "spin", "idle"]
                    : ["walk", "walk", "wave", "spin", "idle"];

          action = pool[Math.floor(Math.random() * pool.length)] || "idle";
          started = now;
          until = now + (action === "walk" ? 3.8 + Math.random() * 2.5 : action === "flip" ? 1.7 : action === "jump" ? 1.25 : 1.5 + Math.random() * 1.8);

          if (action === "walk" || action === "sit") {
            const destination = Math.random();
            targetX = destination < 0.5 ? -2.0 + Math.random() * 1.2 : 0.7 + Math.random() * 1.15;
            targetZ = action === "sit" ? 0.15 : -0.75 + Math.random() * 1.5;
          }

          if (action === "jump" || action === "flip") {
            targetX = clamp(x + (Math.random() - 0.5) * 0.9, -2.25, 2.25);
            targetZ = clamp(z + (Math.random() - 0.5) * 0.7, -0.65, 0.65);
          }

          activityRef.current?.(ACTION_LABEL[action]);
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

          if (action === "walk" || action === "sit") {
            const dx = targetX - x;
            const dz = targetZ - z;
            const distance = Math.hypot(dx, dz);
            if (distance > 0.035) {
              const speed = action === "sit" ? 0.75 : 0.95;
              const step = Math.min(speed * dt, distance);
              x += (dx / distance) * step;
              z += (dz / distance) * step;
              yaw = Math.atan2(dx, dz);
            }
          }

          x = clamp(x, -2.35, 2.35);
          z = clamp(z, -0.9, 0.9);
          vrm.scene.position.x = x;
          vrm.scene.position.z = z;

          if (action === "jump") {
            vrm.scene.position.y = Math.sin(Math.min(current - started, 1.15) / 1.15 * Math.PI) * 0.42;
          } else if (action === "flip") {
            const phase = Math.min((current - started) / 1.7, 1);
            vrm.scene.position.y = Math.sin(phase * Math.PI) * 0.3;
            vrm.scene.rotation.x = phase * Math.PI * 2;
          } else {
            vrm.scene.position.y = 0;
            vrm.scene.rotation.x = 0;
          }

          if (action === "spin") {
            const phase = Math.min((current - started) / Math.max(until - started, 0.01), 1);
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

          vrm.update?.(dt);
          floor.scale.x = 1 + 0.06 * Math.sin(current * 1.7);
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

  return <div ref={mountRef} className="jarvis-3d-layer" aria-label="Autonomní 3D postava Jarvise" />;
}
