export interface LayerSettings {
  layerHeight: number;
  firstLayerHeight: number;
}

/**
 * Rounds `value` to the nearest height a slicer will actually stop on: the
 * first layer plus some whole number of ordinary layers on top of it
 * (firstLayerHeight + n * layerHeight). Used for the coin's base, since it
 * sits directly on the print bed - its top face is the first surface the
 * slicer lays down a full layer boundary at.
 */
export function snapToFirstLayerStack(value: number, layers: LayerSettings, minLayers = 0): number {
  const { layerHeight, firstLayerHeight } = layers;
  if (layerHeight <= 0) return value;
  const n = Math.max(minLayers, Math.round((value - firstLayerHeight) / layerHeight));
  return firstLayerHeight + n * layerHeight;
}

/**
 * Rounds `value` to the nearest whole multiple of layerHeight - for a
 * feature that sits on top of a surface that's already layer-aligned (a
 * relief or border added above, or cut into, the base), so it only needs
 * to add/remove whole ordinary layers to stay aligned itself.
 */
export function snapToLayerMultiple(value: number, layerHeight: number, minLayers = 1): number {
  if (layerHeight <= 0) return value;
  const n = Math.max(minLayers, Math.round(value / layerHeight));
  return n * layerHeight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface NormalizeBounds {
  baseThickness: { min: number; max: number };
  reliefHeight: { min: number; max: number };
  borderHeight: { min: number; max: number };
}

export interface NormalizeInput {
  baseThickness: number;
  reliefHeight: number;
  borderHeight: number;
}

/**
 * Snaps the coin's Z-height features (base thickness, relief height,
 * border height) to whole print layers, so each one's top surface lands
 * exactly on a layer boundary instead of ending partway through one -
 * base_thickness against the first layer's own height, relief/border
 * height as whole layers on top of that already-aligned surface. Results
 * are clamped back into each field's valid range.
 */
export function normalizeToLayers(
  values: NormalizeInput,
  layers: LayerSettings,
  bounds: NormalizeBounds,
): NormalizeInput {
  const baseThickness = clamp(
    snapToFirstLayerStack(values.baseThickness, layers, 1),
    bounds.baseThickness.min,
    bounds.baseThickness.max,
  );
  const reliefHeight = clamp(
    snapToLayerMultiple(values.reliefHeight, layers.layerHeight),
    bounds.reliefHeight.min,
    bounds.reliefHeight.max,
  );
  const borderHeight = clamp(
    snapToLayerMultiple(values.borderHeight, layers.layerHeight),
    bounds.borderHeight.min,
    bounds.borderHeight.max,
  );
  return { baseThickness, reliefHeight, borderHeight };
}
