try {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");

  window.THREE = THREE;
  window.THREE_GLTFLoader = GLTFLoader;
  window.THREE_VRM = { VRMLoaderPlugin, VRMUtils };
  window.dispatchEvent(new Event("jarvis-vrm-ready"));
} catch (error) {
  console.error("JARVIS VRM loader failed", error);
  // Give the companion a deterministic failure signal instead of leaving it
  // polling forever when a CDN/import map/browser module load fails.
  window.THREE = { __jarvisLoadError: true };
  window.THREE_GLTFLoader = { __jarvisLoadError: true };
  window.THREE_VRM = { __jarvisLoadError: true };
  window.dispatchEvent(new CustomEvent("jarvis-vrm-error", { detail: String(error) }));
}
