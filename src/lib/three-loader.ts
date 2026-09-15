let threePromise: Promise<any> | null = null;

export function loadThree() {
  if (typeof window === "undefined") return Promise.reject(new Error("Three.js requires a browser"));
  const existing = (window as any).THREE;
  if (existing) return Promise.resolve(existing);
  if (threePromise) return threePromise;

  threePromise = new Promise((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>("script[data-jarvis-three]");
    if (current) {
      current.addEventListener("load", () => resolve((window as any).THREE));
      current.addEventListener("error", () => reject(new Error("Three.js failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.min.js";
    script.async = true;
    script.dataset.jarvisThree = "true";
    script.onload = () => {
      const THREE = (window as any).THREE;
      THREE ? resolve(THREE) : reject(new Error("Three.js loaded without a global namespace"));
    };
    script.onerror = () => reject(new Error("Three.js failed to load"));
    document.head.appendChild(script);
  });

  return threePromise;
}
