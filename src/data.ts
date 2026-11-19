import { LIMITS } from "./constants";

import type { Book, Page, PresetKey, FontKey, ThemeColors } from "./types/books";

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

export const photo = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

export const PHOTOS = {
  toast: "1527529482837-4698179dc6ce",
  garden: "1612599542558-f3022089fb38",
  table: "1723373457175-31b09fa7d405",
  room: "1541020230467-e33e4f96f7fc",
  dance: "1651065698103-a23acb606d97",
  group: "1632429098857-f419c08f87ac",
  beach: "1643138874737-33babf17f0a8",
  lunch: "1613109040830-ffdd96756f5e",
  picnic: "1625283518288-00362afc8663",
  water: "1636374934002-306af6602a5d",
};

const weddingPages: Page[] = [
  {
    id: "p1",
    title: "The first toast",
    image: photo(PHOTOS.toast),
    header: "To the two of you",
    body: "We have watched you laugh at the same terrible jokes for eight years. May the next eighty be just as silly, just as kind, and twice as loud. We love you both more than this cake, and that is saying something.",
    author: "Priya and Sam",
    submissionId: "s-b1-1",
  },
  {
    id: "p2",
    title: "First dance",
    image: photo(PHOTOS.dance),
    header: "Keep dancing",
    body: "Theo stepped on your toes twice and you did not stop smiling once. That is the whole marriage advice, really.",
    author: "Aunt June",
    submissionId: "s-b1-2",
  },
  {
    id: "p3",
    title: "The long table",
    image: photo(PHOTOS.table),
    header: "Dinner under the lights",
    body: "Best seat in the house was anywhere near you two. Thank you for feeding us, hugging us and letting us stay far too late.",
    author: "The Okafors",
    submissionId: "s-b1-4",
  },
  {
    id: "p4",
    title: "Garden ceremony",
    image: photo(PHOTOS.garden),
    body: "The vows made the whole back row cry, including the ring bearer, who was mostly crying about the cake.",
    author: "Leo",
  },
  {
    id: "p5",
    title: "Old friends",
    image: photo(PHOTOS.group),
    header: "From the college crew",
    body: "Room 4B forever. We promised we would all show up for this, and look at us. Congratulations, you beautiful nerds.",
    author: "Dani, Kofi and Mei",
  },
  {
    id: "p6",
    title: "After party",
    image: photo(PHOTOS.room),
    header: "Last ones standing",
    body: "Still not sure who requested that song four times. Pretty sure it was the groom.",
    author: "Marco",
  },
];

const lisbonPages: Page[] = [
  {
    id: "l1",
    title: "Beach day",
    image: photo(PHOTOS.beach),
    header: "Day one",
    body: "Salt in our hair before we had even unpacked. Nobody wanted to leave the water.",
  },
  {
    id: "l2",
    title: "Long lunch",
    image: photo(PHOTOS.lunch),
    header: "Three hour lunch",
    body: "Grilled sardines, cold wine and an argument about the best tram line that is still going.",
  },
  {
    id: "l3",
    title: "By the river",
    image: photo(PHOTOS.water),
    body: "Our last evening. We counted boats until the light went gold.",
  },
];

const reunionPages: Page[] = [
  {
    id: "r1",
    title: "Picnic on the dock",
    image: photo(PHOTOS.picnic),
    header: "Ten years later",
    body: "Same lake, same jokes, a few more kids running around. Let us not wait another decade.",
    author: "Hannah",
    submissionId: "s-b4-1",
  },
];

export const SEED_BOOKS: Book[] = [
  {
    id: "b1",
    title: "Maya & Theo's wedding",
    slug: "maya-and-theo",
    kind: "event",
    live: true,
    visibility: "link",
    entries: 48,
    updated: "Updated 2 hours ago",
    preset: "crimson",
    theme: { ...PRESETS.crimson.colors },
    font: "hand",
    lines: true,
    access: "name",
    photoRequired: false,
    messageRequired: true,
    pages: weddingPages,
  },
  {
    id: "b2",
    title: "Grandma Rosa turns 90",
    slug: "rosa-turns-90",
    kind: "event",
    live: false,
    visibility: "link",
    entries: 12,
    updated: "Updated yesterday",
    preset: "golden",
    theme: { ...PRESETS.golden.colors },
    font: "serif",
    lines: true,
    access: "email",
    photoRequired: true,
    messageRequired: false,
    pages: [],
  },
  {
    id: "b3",
    title: "Summer in Lisbon",
    slug: "summer-in-lisbon",
    kind: "personal",
    live: true,
    visibility: "link",
    entries: 3,
    updated: "Updated 3 days ago",
    preset: "skyline",
    theme: { ...PRESETS.skyline.colors },
    font: "serif",
    lines: false,
    access: "name",
    photoRequired: false,
    messageRequired: false,
    pages: lisbonPages,
  },
  {
    id: "b4",
    title: "Pine Lake reunion",
    slug: "pine-lake-reunion",
    kind: "event",
    live: true,
    visibility: "link",
    entries: 31,
    updated: "Updated last week",
    preset: "pine",
    theme: { ...PRESETS.pine.colors },
    font: "mono",
    lines: true,
    access: "strict",
    photoRequired: true,
    messageRequired: true,
    pages: reunionPages,
  },
  {
    id: "b5",
    title: "Ana & Leo's engagement",
    slug: "ana-and-leo",
    kind: "event",
    live: true,
    visibility: "link",
    entries: 5,
    updated: "Updated today",
    preset: "skyline",
    theme: { ...PRESETS.skyline.colors },
    font: "serif",
    lines: true,
    access: "email",
    photoRequired: false,
    messageRequired: false,
    pages: [],
  },
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
