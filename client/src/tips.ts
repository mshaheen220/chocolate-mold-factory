export const GENERATING_TIPS: string[] = [
  // --- Using this app ---
  "Quick Preview swaps complex graphics for a simple outline, so it can be up to 20x faster than a Full Render.",
  "Full Render always uses the exact graphic and full facet quality — that's the only output worth 3D printing.",
  "Download STL only ever points at your last Full Render, so you can never accidentally print a rough draft.",
  "The layout preview under Asset Upload updates instantly as you drag sliders — no need to regenerate just to check sizing.",
  "Beaded borders are the slowest detail to compile. Try Quick Preview first if you're using one.",
  "Draft Angle controls how easily a piece releases from a printed mold — 3–5° is a solid default.",
  "Corner Radius only affects square and rectangle tokens.",
  "Token grids let you cast several chocolates from a single silicone mold in one pour.",
  "The Adjustable Mold Frame reuses the same printed wall strips for boxes of many different sizes.",
  "Silicone Depth sets how deep your poured mold will be — leave headroom above your tallest relief.",
  "Uploading a new SVG re-fits the scale automatically to your current token size.",
  "Outer Margin adds silicone around your token grid — more margin means a sturdier, longer-lasting mold.",
  "Reusable Mold Box mode builds a pour dam around your tokens so you can cast a silicone mold directly from the print.",

  // --- Printing & making the silicone mold ---
  "These prints are just masters for silicone, not the final part — 10–15% infill is plenty. Put your effort into layer height and walls instead.",
  "A fine layer height (0.1–0.12mm) keeps layer lines subtle, since they telegraph straight into the silicone and then into every chocolate you cast.",
  "Add an extra perimeter or two (3–4 walls) and slow the outer-wall speed down for crisper relief edges on the master.",
  "Bump top/bottom shell layers to 4–6 even at low infill, so the face touching the silicone stays fully solid and smooth.",
  "Light wet-sanding (400–600 grit) after printing removes remaining layer lines before you pour silicone over the master.",
  "For the Adjustable Mold Frame: glue or clamp 4 printed strips into a rectangle around your master, then pour — no full box reprint needed per layout.",
  "Use a food-safe, platinum-cure silicone for the mold — tin-cure silicones can inhibit release and degrade faster from cocoa butter.",
  "A thin coat of mold release (or petroleum jelly) on the sanded master keeps silicone from bonding to the print.",
  "Let silicone cure fully per its datasheet before demolding — pulling it early can tear fine relief detail.",
  "PLA holds fine detail well and sands easily, making it a solid default material for printed mold masters.",
];

export function pickRandomTipIndex(exclude?: number): number {
  if (GENERATING_TIPS.length <= 1) return 0;
  let index = Math.floor(Math.random() * GENERATING_TIPS.length);
  if (index === exclude) {
    index = (index + 1) % GENERATING_TIPS.length;
  }
  return index;
}
