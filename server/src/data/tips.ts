// Mirrors client/src/tips.ts. There's no shared workspace package to hold a
// single copy across the client (Vite) and server (tsc) build setups, so
// keep this list in sync by hand when tips change on the client.
export interface Tip {
  category: string;
  text: string;
}

export const TIPS: Tip[] = [
  // --- Using this app ---
  { category: "generating", text: "Quick Preview swaps complex graphics for a simple outline, so it can be up to 20x faster than a Full Render." },
  { category: "generating", text: "Full Render always uses the exact graphic and full facet quality — that's the only output worth 3D printing." },
  { category: "generating", text: "Download STL only ever points at your last Full Render, so you can never accidentally print a rough draft." },
  { category: "generating", text: "The layout preview under Asset Upload updates instantly as you drag sliders — no need to regenerate just to check sizing." },
  { category: "generating", text: "Beaded borders are the slowest detail to compile. Try Quick Preview first if you're using one." },
  { category: "generating", text: "Draft Angle leans every wall of the raised design inward so it releases from the silicone. On thin lines, a lower relief height helps more than a bigger angle." },
  { category: "generating", text: "Uploading a new SVG re-fits the scale automatically to your current coin size." },
  { category: "generating", text: "Render Detail ($fn) only affects Full Render — Quick Preview always uses a fast fixed value so it stays quick regardless of this setting." },

  // --- Slicer settings ---
  { category: "slicing", text: "A 0.2mm nozzle resolves fine detail — like individual hair or beard strands — that a standard 0.4mm nozzle will blob together or skip entirely." },
  { category: "slicing", text: "A 0.08–0.10mm layer height keeps stairstepping minimal on curved surfaces; set just the first layer taller (~0.12mm) for reliable bed adhesion without over-squishing." },
  { category: "slicing", text: "Use 3–4 perimeters, ideally with an Arachne-style variable-width wall generator if your slicer offers one, so thin tips like hair strands print as solid ribs instead of gapped or hollow walls." },
  { category: "slicing", text: "Set top shell layers to 6–8 (higher than default) to prevent pillowing — a rippled texture that shows up on flat plateau surfaces like a hat brim or forehead." },
  { category: "slicing", text: "A low-percentage (~4%) rectilinear infill gives the master enough rigidity to resist flexing under the weight of poured silicone, without adding much print time." },
  { category: "slicing", text: "Ironing the top surfaces (optional) gives flat areas of the coin face a smooth, almost mirror-like finish." },

  // --- Printing & making the silicone mold ---
  { category: "printing", text: "Light wet-sanding (400–600 grit) after printing removes remaining layer lines before you pour silicone over the master." },
  { category: "printing", text: "Use a food-safe, platinum-cure silicone for the mold — tin-cure silicones can inhibit release and degrade faster from cocoa butter." },
  { category: "printing", text: "A thin coat of mold release (or petroleum jelly) on the sanded master keeps silicone from bonding to the print." },
  { category: "printing", text: "Let silicone cure fully per its datasheet before demolding — pulling it early can tear fine relief detail." },
  { category: "printing", text: "PLA holds fine detail well and sands easily, making it a solid default material for printed mold masters." },
];
