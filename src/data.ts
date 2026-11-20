import { LIMITS } from "./constants";

import type { PresetKey, FontKey, ThemeColors } from "./types/books";

// Domain types live in src/types so the backend can share them.
export type {
  Access,
  Book,
  BookKind,
  FontKey,
  Page,
  PresetKey,
  ThemeColors,
  Visibility,
} from "./types/books";

export const PRESETS: Record<PresetKey, { name: string; colors: ThemeColors }> = {
  golden: {
    name: "Golden Finch",
    colors: {
      background: "#FFF7E8",
      grid: "#F1DFBC",
      cover: "#F4A261",
      accent: "#B8621B",
      text: "#3A3226",
      header: "#2B2D42",
    },
  },
  crimson: {
    name: "Crimson Nest",
    colors: {
      background: "#FDF4F1",
      grid: "#F1D5CF",
      cover: "#E63946",
      accent: "#F4A261",
      text: "#2B2D42",
      header: "#9B1D2A",
    },
  },
  skyline: {
    name: "Skyline Dusk",
    colors: {
      background: "#F0F2F8",
      grid: "#D6DCEB",
      cover: "#3D4A7A",
      accent: "#F4A261",
      text: "#2B2D42",
      header: "#2E3866",
    },
  },
  pine: {
    name: "Pine Woodland",
    colors: {
      background: "#F2F5EF",
      grid: "#D6E0D0",
      cover: "#2F5D46",
      accent: "#E9C46A",
      text: "#26332B",
      header: "#1F3B2D",
    },
  },
};

export const FONTS: Record<FontKey, { name: string; family: string; weight: number }> = {
  sans: { name: "Modern Sans Bold", family: "'Work Sans', 'DM Sans', sans-serif", weight: 700 },
  hand: { name: "Indie Flower", family: "'Indie Flower', cursive", weight: 400 },
  serif: { name: "Georgia", family: "Georgia, 'Times New Roman', serif", weight: 400 },
  mono: { name: "Courier New", family: "'Courier New', Courier, monospace", weight: 400 },
};

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "grid", label: "Grid" },
  { key: "cover", label: "Cover" },
  { key: "accent", label: "Feather accent" },
  { key: "text", label: "Text" },
  { key: "header", label: "Header text" },
];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slug);

export { RESERVED_SLUGS } from "./constants";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
