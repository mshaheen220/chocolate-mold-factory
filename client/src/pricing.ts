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
