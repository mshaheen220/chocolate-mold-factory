// 2D Graphic to Contoured Chocolate Piece (outline follows the artwork)
// All variables below are overridden at compile time via `-D name=value`
// from the backend. Defaults here only matter when opening this file
// directly in the OpenSCAD GUI for template development.
//
// The client splits the uploaded artwork into one SVG per run of same-
// colored shapes (in paint order, bottom to top), already flattened to
// polygons, cleaned of tiny detached specks, and translated so every file
// shares one frame: viewBox "0 0 art_width art_height", 1 unit = 1mm
// before piece scaling. (A non-zero viewBox origin is deliberately never
// used - OpenSCAD 2021.01 shifts Y the wrong way for one.)

/* [Layers] */
layer_paths    = [];  // absolute paths to each color layer's .svg, bottom to top
layer_heights  = [];  // mm above (+) or into (-) the base's top face, per layer
layer_included = [];  // true = part of the piece; false = background (only masks layers below it)

/* [Piece Geometry] */
art_width      = 100; // shared layer frame size, in SVG user units
art_height     = 100;
piece_size     = 50;  // length of the piece's longest side, in mm (before outline margin)
base_thickness = 4;
outline_margin = 0;   // grows the outline outward - a clean rim around the artwork, and bridges tiny gaps

/* [Base Plate] */
// An optional lower tier under the design: a smooth plate (the design's
// convex hull, grown by plate_border) with the design standing on top of
// it by base_thickness. Fills every notch and gap in the outline.
base_plate      = "none"; // none | hull
plate_border    = 4;      // how far the plate extends past the design's outline
plate_thickness = 2;

/* [Back Label] */
label_x = 0; // mm from the piece's center - the client picks the point deepest inside the outline
label_y = 0;

version_label = ""; // optional short text etched into the back (bed-facing) side - "" = no label

$fn = 96;

piece_scale = piece_size / max(art_width, art_height);
layer_count = len(layer_paths);

// ---------------------------------------------------------------------
// Layer regions
// ---------------------------------------------------------------------

module layer_raw(i) {
  scale(piece_scale)
    translate([-art_width / 2, -art_height / 2])
      import(layer_paths[i]);
}

// What's actually visible of layer i: its shapes minus everything painted
// on top of it, exactly as the SVG renders. Traced artwork usually has
// non-overlapping layers already, but stacked artwork (a gold shape drawn
// over a blue one) needs this so each spot gets exactly one height.
module layer_visible(i) {
  if (i < layer_count - 1) {
    difference() {
      layer_raw(i);
      for (j = [i + 1 : layer_count - 1]) layer_raw(j);
    }
  } else {
    layer_raw(i);
  }
}

module silhouette_2d() {
  for (i = [0 : layer_count - 1])
    if (layer_included[i]) layer_visible(i);
}

module outline_2d() {
  if (outline_margin > 0) {
    offset(r = outline_margin) silhouette_2d();
  } else {
    silhouette_2d();
  }
}

// ---------------------------------------------------------------------
// Piece
//
// Built entirely as a union of stacked extrusions - no 3D difference().
// A CGAL difference against this many outline vertices is pathologically
// slow (measured: a back label cut via difference() took a Full Render of
// the panther-paw demo from ~6s to ~15 minutes). Every cut is done in 2D
// instead: the back label is removed from the bottom slab's outline, and
// engraved colors are removed from the main slab and re-added as shorter
// columns.
// ---------------------------------------------------------------------

plate_on = base_plate != "none";

module plate_2d() {
  offset(r = plate_border) hull() outline_2d();
}

// Everything that touches the print bed: the plate if there is one,
// otherwise the design's own outline.
module footprint_2d() {
  if (plate_on) plate_2d(); else outline_2d();
}

// Z where the design's own body starts (on top of the plate, if any).
body_z = plate_on ? plate_thickness : 0;

VERSION_LABEL_DEPTH = 0.4; // mm - shallow: identification only, not a structural feature
bottom_tier = plate_on ? plate_thickness : base_thickness;
label_depth = version_label != "" ? min(VERSION_LABEL_DEPTH, max(0, bottom_tier - 0.4)) : 0;

module version_label_2d() {
  label_len = len(version_label);
  // Same sizing idea as medallion.scad, against the piece's longest side.
  text_size = min(piece_size * 0.12, 3, (piece_size * 0.5) / max(1, label_len * 0.6));
  // Mirrored so the label reads correctly once the piece is turned over.
  translate([label_x, label_y])
    mirror([1, 0, 0])
      text(version_label, size = text_size, halign = "center", valign = "center", font = "DejaVu Sans:style=Bold");
}

// Where the design's body slab starts: right on the plate, or just above
// the back label when the design is the bottom tier itself.
body_floor = plate_on ? body_z : label_depth;

// Engraving depth for layer i. With a plate, it may go all the way down
// to the plate's top; without one, at least 0.2mm of chocolate always
// remains above the back label, so it can never cut a hole through.
function engrave_depth(i) =
  min(-layer_heights[i], plate_on ? base_thickness : max(0, base_thickness - label_depth - 0.2));

function is_engraved(i) = layer_included[i] && layer_heights[i] < 0 && engrave_depth(i) > 0;

module engraved_2d() {
  for (i = [0 : layer_count - 1])
    if (is_engraved(i)) layer_visible(i);
}

module piece() {
  top_z = body_z + base_thickness;
  union() {
    if (label_depth > 0) {
      linear_extrude(height = label_depth)
        difference() {
          footprint_2d();
          version_label_2d();
        }
    }

    if (plate_on) {
      translate([0, 0, label_depth])
        linear_extrude(height = plate_thickness - label_depth)
          plate_2d();
    }

    translate([0, 0, body_floor])
      linear_extrude(height = top_z - body_floor)
        difference() {
          outline_2d();
          engraved_2d();
        }

    for (i = [0 : layer_count - 1]) {
      column = top_z - engrave_depth(i) - body_floor;
      if (is_engraved(i) && column > 0.001) {
        translate([0, 0, body_floor])
          linear_extrude(height = column)
            layer_visible(i);
      }
      if (layer_included[i] && layer_heights[i] > 0) {
        translate([0, 0, top_z])
          linear_extrude(height = layer_heights[i])
            layer_visible(i);
      }
    }
  }
}

if (layer_count > 0) piece();
