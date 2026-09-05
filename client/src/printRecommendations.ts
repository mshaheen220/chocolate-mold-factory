export interface SlicerSetting {
  setting: string;
  value: string;
  why: string;
}

export const NOZZLE_RECOMMENDATION: SlicerSetting = {
  setting: "Nozzle Size",
  value: "0.2mm",
  why: "Resolves fine detail - like individual hair or beard strands - that a standard 0.4mm nozzle blobs together or skips entirely.",
};

export const FILAMENT_RECOMMENDATION: SlicerSetting = {
  setting: "Filament",
  value: "PLA",
  why: "Holds fine detail well and sands easily, making it a solid default for printed mold masters.",
};

export const SLICER_SETTINGS: SlicerSetting[] = [
  {
    setting: "Layer Height",
    value: "0.08-0.10mm",
    why: "Keeps stairstepping minimal on curved surfaces - layer lines telegraph straight into the silicone and then into every chocolate cast from it.",
  },
  {
    setting: "First Layer Height",
    value: "0.12mm",
    why: "Reliable bed adhesion without over-squishing the first layer.",
  },
  {
    setting: "Bed Surface",
    value: "Doesn't matter (textured or smooth)",
    why: "Only the top relief face touches silicone - bed texture only affects the flat underside. Just make sure the first layer goes down flat and fully adhered, so the master sits flush in the pour box without letting silicone seep underneath.",
  },
  {
    setting: "Walls / Perimeters",
    value: "3-4 (Arachne wall generator if available)",
    why: "Prints thin tips - hair or beard strands - as solid ribs instead of gapped or hollow walls.",
  },
  {
    setting: "Top Shell Layers",
    value: "6-8",
    why: "Prevents pillowing - a rippled texture on flat plateau surfaces like a hat brim or forehead.",
  },
  {
    setting: "Infill",
    value: "30% Gyroid",
    why: "Gives the master enough rigidity to resist flexing under the weight of poured silicone.",
  },
  {
    setting: "Ironing",
    value: "Top surfaces only (optional)",
    why: "Gives flat areas of the coin face a smooth, near-mirror finish.",
  },
];

export const POST_PROCESSING_STEPS: string[] = [
  "Light wet-sanding (400-600 grit) removes remaining layer lines before pouring silicone over the master.",
  "Use a food-safe, platinum-cure silicone - tin-cure silicones can inhibit release and degrade faster from cocoa butter.",
  "A thin coat of mold release (or petroleum jelly) on the sanded master keeps silicone from bonding to the print.",
  "Let silicone cure fully per its datasheet before demolding - pulling it early can tear fine relief detail.",
];
