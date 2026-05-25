// Complete anatomy taxonomy for the hybrid programming model
export const MUSCLE_TAGS = {
  chest: {
    label: "Petto",
    muscles: ["Pettorali (c. clavicolari)", "Pettorali (c. sternali)", "Pettorali (c. costali)"],
  },
  back: {
    label: "Schiena",
    muscles: [
      "Gran Dorsale",
      "Trapezi (superiori)",
      "Trapezi (medi)",
      "Trapezi (inferiori)",
      "Erettori Spinali",
    ],
  },
  shoulders: {
    label: "Spalle",
    muscles: ["Deltoidi (anteriori)", "Deltoidi (mediali)", "Deltoidi (posteriori)"],
  },
  arms: {
    label: "Braccia",
    muscles: [
      "Tricipiti (capo lungo)",
      "Tricipiti (capo laterale)",
      "Tricipiti (capo mediale)",
      "Bicipiti (capo lungo)",
      "Bicipiti (capo corto)",
      "Avambracci",
    ],
  },
  legs: {
    label: "Gambe",
    muscles: [
      "Quadricipiti",
      "Ischiocrurali",
      "Medio Gluteo",
      "Grande Gluteo",
      "Polpacci (gastrocnemio)",
      "Polpacci (soleo)",
    ],
  },
  core: {
    label: "Core",
    muscles: [
      "Addominali (retto addominale)",
      "Addominali (obliquo esterno)",
      "Addominali (trasverso)",
    ],
  },
} as const;

// Flat list of all muscles for easy iteration
const ALL_MUSCLES = Object.values(MUSCLE_TAGS).flatMap((category) => category.muscles);

// Movement patterns for exercise classification
export const MOVEMENT_PATTERNS = [
  { value: "spinta_orizzontale", label: "Spinta Orizzontale" },
  { value: "spinta_verticale", label: "Spinta Verticale" },
  { value: "tirata_orizzontale", label: "Tirata Orizzontale" },
  { value: "tirata_verticale", label: "Tirata Verticale" },
  { value: "squat", label: "Squat" },
  { value: "hinge", label: "Hinge" },
  { value: "lunge", label: "Lunge" },
  { value: "carry", label: "Carry" },
  { value: "core_anti_estensione", label: "Core (anti-estensione)" },
  { value: "core_anti_rotazione", label: "Core (anti-rotazione)" },
  { value: "core_anti_flessione_laterale", label: "Core (anti-flessione laterale)" },
] as const;

// Exercise types for classification
export const EXERCISE_TYPES = [
  { value: "Multi-articolare", label: "Multi-articolare" },
  { value: "Mono-articolare", label: "Mono-articolare" },
  { value: "Cardiovascolare", label: "Cardiovascolare" },
] as const;

// Get the macro category for a muscle
function getMuscleCategory(muscle: string): string | undefined {
  for (const category of Object.values(MUSCLE_TAGS)) {
    if ((category.muscles as readonly string[]).includes(muscle)) {
      return category.label;
    }
  }
  return undefined;
}

// Get all muscles grouped by category for multi-select
export function getMusclesGrouped(): Array<{
  category: string;
  categoryKey: string;
  muscles: string[];
}> {
  return Object.entries(MUSCLE_TAGS).map(([key, category]) => ({
    category: category.label,
    categoryKey: key,
    muscles: category.muscles.map((m) => m as string),
  }));
}
