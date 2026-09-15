const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const THREE_ADDONS_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/";
const VRM_URL = "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.5.5/lib/three-vrm.module.min.js";

try {
  const THREE = await import(THREE_URL);
  const { GLTFLoader } = await import(`${THREE_ADDONS_URL}loaders/GLTFLoader.js`);
  const { VRMLoaderPlugin, VRMUtils } = await import(VRM_URL);
  window.THREE = THREE;
  window.THREE_GLTFLoader = GLTFLoader;
  window.THREE_VRM = { VRMLoaderPlugin, VRMUtils };
  window.dispatchEvent(new Event("jarvis-vrm-ready"));
} catch (error) {
  console.error("JARVIS VRM loader failed", error);
  window.dispatchEvent(new CustomEvent("jarvis-vrm-error", { detail: String(error) }));
}
