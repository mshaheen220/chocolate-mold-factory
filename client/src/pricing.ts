export interface ChocolatePrice {
  id: string;
  label: string;
  pricePerOz: number;
}

export const CHOCOLATE_PRICES_PER_OZ: ChocolatePrice[] = [
  { id: "milk", label: "Milk", pricePerOz: 0.34 },
  { id: "dark", label: "Dark", pricePerOz: 0.41 },
  { id: "white", label: "White", pricePerOz: 0.42 },
  { id: "colored", label: "Colored", pricePerOz: 0.45 },
];

export interface FilamentMaterial {
  id: string;
  label: string;
  densityGPerCm3: number;
  pricePerKg: number;
}

// Placeholder consumer-spool prices - adjust to match what you actually
// pay. Densities are standard published values for each material.
export const FILAMENT_MATERIALS: FilamentMaterial[] = [
  { id: "pla", label: "PLA", densityGPerCm3: 1.24, pricePerKg: 16 },
  { id: "petg", label: "PETG", densityGPerCm3: 1.27, pricePerKg: 18 },
];

export interface SiliconeMaterial {
  id: string;
  label: string;
  densityGPerCm3: number;
  pricePerMl: number;
}

// Priced from an actual purchase, not a list price: Alumilite 16oz Amazing
// Mold Maker kit (473mL total - two 8oz/237mL bottles, Part A + Part B
// combined 1:1), paid $25. Update the two constants below when buying in
// bulk or switching products.
const ALUMILITE_KIT_PRICE_USD = 25;
const ALUMILITE_KIT_VOLUME_ML = 473;

export const SILICONE_MATERIALS: SiliconeMaterial[] = [
  {
    id: "alumilite-mold-maker",
    label: "Alumilite Mold Maker",
    densityGPerCm3: 1.1, // typical platinum-cure silicone density
    pricePerMl: ALUMILITE_KIT_PRICE_USD / ALUMILITE_KIT_VOLUME_ML,
  },
];
