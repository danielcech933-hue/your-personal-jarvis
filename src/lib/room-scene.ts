import { ENVIRONMENTS, type RoomLayout } from "@/lib/room-layout";

/** Builds the 3D environment + user furniture. `T` is the lazily imported three module. */
export function buildRoomScene(T: any, layout: RoomLayout, accentColor: number) {
  const env = ENVIRONMENTS[layout.env];
  const group = new T.Group();
  const std = (color: number | string, extra: Record<string, unknown> = {}) => new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
  const add = (geo: any, mat: any, x: number, y: number, z: number, parent = group) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // Ground
  const floor = new T.Mesh(new T.PlaneGeometry(14, 10), std(env.floor, { roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  const trim = std(accentColor, { emissive: accentColor, emissiveIntensity: 0.35, metalness: 0.4 });
  const glass = std(0x12324d, { emissive: 0x0d3350, emissiveIntensity: 0.55, transparent: true, opacity: 0.8, roughness: 0.18 });

  if (env.wall !== null) {
    add(new T.PlaneGeometry(14, 3.4), std(env.wall, { roughness: 0.95 }), 0, 1.7, -1.6);
    add(new T.PlaneGeometry(2.1, 1.35), layout.env === "apartment" ? std(0x9cc6e8, { emissive: 0x5b87ad, emissiveIntensity: 0.5 }) : glass, 0.7, 1.55, -1.58);
    for (const x of [-0.37, 0.7, 1.77]) add(new T.BoxGeometry(0.04, 1.4, 0.04), layout.env === "apartment" ? std(0xf1e6d2) : trim, x, 1.55, -1.55);
    if (layout.env === "apartment") { const rug = new T.Mesh(new T.CircleGeometry(1.4, 40), std(0x8a5a44, { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.005, 0.5); group.add(rug); add(new T.BoxGeometry(1, 1.8, 0.3), std(0x4a3020), -3.2, 0.9, -1.4); }
    else { const rug = new T.Mesh(new T.CircleGeometry(1.5, 48), std(0x16283d, { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.005, 0.5); group.add(rug); }
  } else if (layout.env === "park") {
    const path = new T.Mesh(new T.PlaneGeometry(1.4, 10), std(0xa89a82, { roughness: 1 })); path.rotation.x = -Math.PI / 2; path.position.set(0.2, 0.006, 0); group.add(path);
    for (const [x, z, s] of [[-4, -3, 1.3], [4.2, -2.6, 1.1], [-2.8, -4, 1.5], [3, -4.2, 1.4], [0.6, -5, 1.2]] as const) { add(new T.CylinderGeometry(0.12 * s, 0.16 * s, 1.4 * s, 10), std(0x5b3d26), x, 0.7 * s, z); add(new T.SphereGeometry(0.8 * s, 16, 12), std(0x2e6b33, { roughness: 1 }), x, 1.7 * s, z); }
    add(new T.BoxGeometry(2.4, 0.9, 0.05), std(0x6b4a2f), 0.4, 0.45, -1.3); // railing / fence
  } else {
    // rooftop: glass railing and skyline
    add(new T.BoxGeometry(8, 1, 0.04), std(0x9fd8ff, { transparent: true, opacity: 0.25, roughness: 0.1 }), 0, 0.5, -1.45);
    add(new T.BoxGeometry(8, 0.04, 0.06), trim, 0, 1.0, -1.45);
    for (let i = 0; i < 16; i += 1) { const h = 2 + ((i * 37) % 7); add(new T.BoxGeometry(0.9, h, 0.9), std(0x1a2238, { emissive: i % 3 ? 0x2a3a66 : 0x553a22, emissiveIntensity: 0.35 }), -7.5 + i, h / 2 - 1.5, -6 - (i % 3)); }
  }

  const furniture = new T.Group(); group.add(furniture);
  const { desk, sofa, decor, lamp } = layout.items;

  // Desk
  const d = new T.Group(); d.position.set(desk.x, 0, desk.z); d.rotation.y = desk.rot; furniture.add(d);
  const deskMat = desk.variant === "glass" ? std(desk.color, { transparent: true, opacity: 0.55, roughness: 0.1 }) : std(desk.color, { roughness: desk.variant === "wood" ? 0.8 : 0.45 });
  add(new T.BoxGeometry(1.7, 0.06, 0.72), deskMat, 0, 0.74, 0, d);
  for (const x of [-0.78, 0.78]) add(new T.BoxGeometry(0.07, 0.74, 0.07), std(0x1a1f2a), x, 0.37, 0, d);
  add(new T.BoxGeometry(0.66, 0.4, 0.04), std(0x10141c), 0, 1.06, -0.25, d);
  add(new T.PlaneGeometry(0.6, 0.34), glass, 0, 1.06, -0.228, d);
  add(new T.BoxGeometry(0.46, 0.07, 0.46), std(0x1a2c44), 0, 0.43, 0.6, d);
  add(new T.BoxGeometry(0.46, 0.5, 0.07), std(0x1a2c44), 0, 0.7, 0.81, d);

  // Seating
  const s = new T.Group(); s.position.set(sofa.x, 0, sofa.z); s.rotation.y = sofa.rot; furniture.add(s);
  const soft = std(sofa.color, { roughness: 0.88 });
  if (sofa.variant === "bench") { add(new T.BoxGeometry(1.7, 0.06, 0.45), soft, 0, 0.44, 0.02, s); add(new T.BoxGeometry(1.7, 0.4, 0.05), soft, 0, 0.7, -0.22, s); for (const x of [-0.75, 0.75]) add(new T.BoxGeometry(0.06, 0.44, 0.45), std(0x222222, { metalness: 0.6 }), x, 0.22, 0, s); }
  else if (sofa.variant === "lounger") { add(new T.BoxGeometry(0.8, 0.3, 1.6), soft, 0, 0.29, 0.1, s); const back = add(new T.BoxGeometry(0.8, 0.6, 0.12), soft, 0, 0.6, -0.65, s); back.rotation.x = -0.4; }
  else { add(new T.BoxGeometry(1.8, 0.36, 0.9), soft, 0, 0.18, 0, s); add(new T.BoxGeometry(1.7, 0.12, 0.84), soft, 0, 0.41, 0.02, s); add(new T.BoxGeometry(1.8, 0.55, 0.18), soft, 0, 0.63, -0.36, s); for (const x of [-0.84, 0.84]) add(new T.BoxGeometry(0.16, 0.24, 0.9), soft, x, 0.5, 0, s); }

  // Decor
  const c = new T.Group(); c.position.set(decor.x, 0, decor.z); c.rotation.y = decor.rot; furniture.add(c);
  if (decor.variant === "tree") { add(new T.CylinderGeometry(0.08, 0.12, 1.2, 10), std(0x5b3d26), 0, 0.6, 0, c); add(new T.SphereGeometry(0.55, 16, 12), std(decor.color, { roughness: 1 }), 0, 1.45, 0, c); }
  else if (decor.variant === "robot") { add(new T.BoxGeometry(0.4, 0.5, 0.3), std(decor.color, { metalness: 0.6, roughness: 0.3 }), 0, 0.45, 0, c); add(new T.SphereGeometry(0.17, 16, 12), std(0xdfe8f2, { metalness: 0.5 }), 0, 0.88, 0, c); add(new T.SphereGeometry(0.04, 8, 8), trim, 0.06, 0.9, 0.15, c); add(new T.SphereGeometry(0.04, 8, 8), trim, -0.06, 0.9, 0.15, c); add(new T.CylinderGeometry(0.06, 0.08, 0.2, 10), std(0x333a44), 0, 0.1, 0, c); }
  else if (decor.variant === "speaker") { add(new T.BoxGeometry(0.6, 0.5, 0.45), std(0x4a3020), 0, 0.25, 0, c); add(new T.CylinderGeometry(0.22, 0.22, 0.02, 24), std(0x111111), 0, 0.51, 0, c); add(new T.CylinderGeometry(0.06, 0.06, 0.025, 12), std(decor.color, { emissive: decor.color, emissiveIntensity: 0.3 }), 0, 0.52, 0, c); }
  else { add(new T.CylinderGeometry(0.15, 0.12, 0.28, 16), std(0x2a2f38), 0, 0.14, 0, c); add(new T.SphereGeometry(0.28, 16, 12), std(decor.color, { roughness: 0.9 }), 0, 0.48, 0, c); }

  // Lamp
  const l = new T.Group(); l.position.set(lamp.x, 0, lamp.z); furniture.add(l);
  const bulbMat = std(lamp.color, { emissive: lamp.color, emissiveIntensity: 1.2 });
  if (lamp.variant === "lantern") { add(new T.CylinderGeometry(0.03, 0.03, 1.5, 8), std(0x222222, { metalness: 0.7 }), 0, 0.75, 0, l); add(new T.BoxGeometry(0.2, 0.28, 0.2), bulbMat, 0, 1.6, 0, l); }
  else if (lamp.variant === "neon") { add(new T.TorusGeometry(0.28, 0.025, 8, 32), bulbMat, 0, 1.7, -0.3, l); }
  else { add(new T.CylinderGeometry(0.15, 0.15, 0.03, 16), std(0x222222), 0, 0.015, 0, l); add(new T.CylinderGeometry(0.02, 0.02, 1.5, 8), std(0x222222), 0, 0.75, 0, l); add(new T.ConeGeometry(0.22, 0.25, 20, 1, true), bulbMat, 0, 1.55, 0, l); }
  const pl = new T.PointLight(new T.Color(lamp.color), 1.1, 4); pl.position.set(0, 1.5, 0); l.add(pl);

  return { group, sky: env.sky, fog: env.fog, light: env.light };
}
