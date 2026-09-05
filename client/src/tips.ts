export type TipCategory = "generating" | "slicing" | "printing";

export interface Tip {
  category: TipCategory;
  text: string;
}

export const TIPS: Tip[] = [
  // --- Using this app ---
  { category: "generating", text: "Quick Preview swaps complex graphics for a simple outline, so it can be up to 20x faster than a Full Render." },
  { category: "generating", text: "Full Render always uses the exact graphic and full facet quality — that's the only output worth 3D printing." },
  { category: "generating", text: "Download STL only ever points at your last Full Render, so you can never accidentally print a rough draft." },
  { category: "generating", text: "The layout preview under Asset Upload updates instantly as you drag sliders — no need to regenerate just to check sizing." },
  { category: "generating", text: "Beaded borders are the slowest detail to compile. Try Quick Preview first if you're using one." },
  { category: "generating", text: "Draft Angle controls how easily a piece releases from a printed mold — 3–5° is a solid default." },
  { category: "generating", text: "Corner Radius only affects square and rectangle tokens." },
  { category: "generating", text: "Grid Columns/Rows (used by Reusable Mold Box and Adjustable Frame Preview) arrange several tokens so one silicone mold casts several chocolates per pour." },
  { category: "generating", text: "The Adjustable Mold Frame reuses the same printed wall strips for boxes of many different sizes." },
  { category: "generating", text: "Silicone Depth sets how deep your poured mold will be — leave headroom above your tallest relief." },
  { category: "generating", text: "Uploading a new SVG re-fits the scale automatically to your current token size." },
  { category: "generating", text: "Outer Margin adds silicone around your token grid — more margin means a sturdier, longer-lasting mold." },
  { category: "generating", text: "Reusable Mold Box mode builds a pour dam around your tokens so you can cast a silicone mold directly from the print." },
  { category: "generating", text: "Render Detail ($fn) only affects Full Render — Quick Preview always uses a fast fixed value so it stays quick regardless of this setting." },

  // --- Slicer settings ---
  { category: "slicing", text: "A 0.2mm nozzle resolves fine detail — like individual hair or beard strands — that a standard 0.4mm nozzle will blob together or skip entirely." },
  { category: "slicing", text: "A 0.08–0.10mm layer height keeps stairstepping minimal on curved surfaces; set just the first layer taller (~0.12mm) for reliable bed adhesion without over-squishing." },
  { category: "slicing", text: "Use 3–4 perimeters, ideally with an Arachne-style variable-width wall generator if your slicer offers one, so thin tips like hair strands print as solid ribs instead of gapped or hollow walls." },
  { category: "slicing", text: "Set top shell layers to 6–8 (higher than default) to prevent pillowing — a rippled texture that shows up on flat plateau surfaces like a hat brim or forehead." },
  { category: "slicing", text: "30% gyroid infill gives the master enough rigidity to resist flexing under the weight of poured silicone, without adding much print time over a low-infill part." },
  { category: "slicing", text: "Ironing the top surfaces (optional) gives flat areas of the coin face a smooth, almost mirror-like finish." },

  // --- Printing & making the silicone mold ---
  { category: "printing", text: "Light wet-sanding (400–600 grit) after printing removes remaining layer lines before you pour silicone over the master." },
  { category: "printing", text: "For the Adjustable Mold Frame: glue or clamp 4 printed strips into a rectangle around your master, then pour — no full box reprint needed per layout." },
  { category: "printing", text: "Use a food-safe, platinum-cure silicone for the mold — tin-cure silicones can inhibit release and degrade faster from cocoa butter." },
  { category: "printing", text: "A thin coat of mold release (or petroleum jelly) on the sanded master keeps silicone from bonding to the print." },
  { category: "printing", text: "Let silicone cure fully per its datasheet before demolding — pulling it early can tear fine relief detail." },
  { category: "printing", text: "PLA holds fine detail well and sands easily, making it a solid default material for printed mold masters." },
];

/** Fisher-Yates shuffle of [0, length) - used to tour every tip exactly
 * once in a random order before repeating, rather than picking randomly
 * with replacement (which can stall on a few tips and never reach others). */
export function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export function pickRandomTipIndex(exclude?: number): number {
  if (TIPS.length <= 1) return 0;
  let index = Math.floor(Math.random() * TIPS.length);
  if (index === exclude) {
    index = (index + 1) % TIPS.length;
  }
  return index;
}
