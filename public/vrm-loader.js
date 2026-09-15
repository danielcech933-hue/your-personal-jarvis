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
  window.dispatchEvent(new CustomEvent("jarvis-vrm-error", { detail: String(error) }));
}
