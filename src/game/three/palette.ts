import * as THREE from "three";

export const GULF_TEAL = "#147c82";
export const SAND_GOLD = "#cba66a";
export const PALETTE = {
  gulf: GULF_TEAL,
  sand: SAND_GOLD,
  limestone: "#eadbbd",
  plaster: "#f3e9d5",
  paleStone: "#d7c7a7",
  asphalt: "#283137",
  silver: "#c4cbcb",
  boubyanGlass: "#779cab",
  wood: "#513827",
  pavement: "#b6a58b",
  dark: "#173c43",
  glass: "#347e88",
  leaf: "#477e60",
  leafLight: "#69946c",
  trunk: "#8f7250",
  white: "#f5f0df",
  red: "#aa5543",
  blue: "#4c819a",
  gold: "#e1bb65",
  black: "#202d30",
  pool: "#46c3c8",
  pitch: "#4f9150",
  track: "#b0654a",
  deepGlass: "#2d5c6b",
  clay: "#c8a77a",
  canvas: "#efe7d6",
  skylight: "#9fc4cb",
} as const;

export function cityMaterials() {
  const opaque = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.77,
    metalness: 0.03,
  });
  const metal = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.52,
  });
  const glass = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.21,
    metalness: 0.3,
  });
  const vehicles = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.58,
    metalness: 0.12,
  });
  const windows = new THREE.MeshStandardMaterial({
    color: "#345c65",
    emissive: "#ffc46b",
    emissiveIntensity: 0.08,
    roughness: 0.4,
    metalness: 0.08,
  });
  const lamps = new THREE.MeshStandardMaterial({
    color: "#ead9ae",
    emissive: "#ffd48a",
    emissiveIntensity: 0.1,
  });
  return { opaque, metal, glass, windows, lamps, vehicles };
}

export type CityMaterials = ReturnType<typeof cityMaterials>;
