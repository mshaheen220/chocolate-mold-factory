// 2D Graphic to Chocolate Coin (single token - circle, oval, square, or rectangle - printed one at a time)
// All variables below are overridden at compile time via `-D name=value`
// from the backend. Defaults here only matter when opening this file
// directly in the OpenSCAD GUI for template development.

/* [Render] */
// Backend-injected, not a user-facing parameter: swaps the imported SVG
// relief for its convex hull. A detailed illustration can have thousands
// of path points, which dominates CGAL compile time regardless of $fn -
// hull() collapses it to a simple outline in near-zero time, since the
// exact artwork is already shown instantly by the client-side 2D layout
// preview. Concave detail (eyes, hair, text) is lost; overall size/
// position/depth is not.
fast_preview = false;

/* [Image & Asset Settings] */
svg_path  = "";  // absolute path to the uploaded graphic.svg ("" = no relief)
svg_scale = 1;
svg_offset_x = 0; // mm, applied after scaling: +X = right
svg_offset_y = 0; // mm, applied after scaling: +Y = up

/* [Piece Geometry] */
token_shape      = "circle"; // circle | square | oval | rectangle
token_size       = 40;       // width: circle diameter / square side / oval X-diameter / rectangle width
token_length     = 60;       // length (Y axis): only used by oval & rectangle; ignored for circle/square
corner_radius    = 4;        // rounding for square & rectangle corners
base_thickness   = 3;
relief_height    = 1.5;
relief_direction = "raised"; // raised | recessed
draft_angle      = 3;

/* [Border] */
border_style     = "none";  // none | single | double | beaded
border_direction = "raised"; // raised | recessed
border_inset     = 3;      // distance from the token's outer edge to the border
border_width     = 1.6;    // thickness of each border line (single & double)
border_gap       = 1.2;    // gap between the two lines (double only)
border_height    = 0.8;    // how far the border rises above (raised) or cuts into (recessed) the token face
bead_count       = 24;     // number of individual beads around the perimeter (beaded only)
bead_size        = 2.5;    // diameter of each bead (beaded only)

/* [Back Label] */
version_label = ""; // optional short text etched into the back (bed-facing) side - "" = no label

$fn = 96;

// ---------------------------------------------------------------------
// Token base shape & relief
// ---------------------------------------------------------------------

function token_effective_length() =
  (token_shape == "oval" || token_shape == "rectangle") ? token_length : token_size;

// The token's smaller side - what "how much room is there" math (draft
// taper, label sizing) should measure against.
function token_min_side() = min(token_size, token_effective_length());

module token_base_2d() {
  if (token_shape == "square") {
    r = min(corner_radius, token_size / 2);
    offset(r = r) offset(delta = -r) square([token_size, token_size], center = true);
  } else if (token_shape == "rectangle") {
    r = min(corner_radius, min(token_size, token_length) / 2);
    offset(r = r) offset(delta = -r) square([token_size, token_length], center = true);
  } else if (token_shape == "oval") {
    scale([1, token_length / token_size])
      circle(d = token_size);
  } else {
    circle(d = token_size);
  }
}

module svg_shape_2d() {
  if (fast_preview) {
    hull() import(svg_path, center = true);
  } else {
    import(svg_path, center = true);
  }
}

module svg_shape_positioned() {
  translate([svg_offset_x, svg_offset_y])
    scale(svg_scale)
      svg_shape_2d();
}

// Adds the relief as a raised bump, tapered by draft angle so it releases
// cleanly from a printed mold cavity.
module svg_relief_raised() {
  if (svg_path != "") {
    taper_ratio = max(0.05, 1 - (2 * relief_height * tan(draft_angle) / token_min_side()));
    linear_extrude(height = relief_height, scale = taper_ratio)
      svg_shape_positioned();
  }
}

// ---------------------------------------------------------------------
// Raised border (single / double ring, or a beaded ring of dots)
// ---------------------------------------------------------------------

// At inset=0 the border's outer edge is exactly coincident with the
// token's own outer wall - subtracting a cutter whose boundary exactly
// matches the solid's boundary (the recessed-border case in token())
// leaves CGAL a degenerate, non-manifold sliver right at the rim. Nudging
// the outer edge out by this much always keeps it strictly past the true
// wall, so a full, clean cut is guaranteed; at any larger inset the same
// nudge is a sub-print-resolution no-op.
BORDER_EDGE_EPS = 0.01;

module ring_2d(inset, width) {
  difference() {
    offset(delta = BORDER_EDGE_EPS - inset) token_base_2d();
    offset(delta = -(inset + width)) token_base_2d();
  }
}

// Analytic distance from the origin to the boundary of a rounded
// rectangle (half-extents hw/hh, corner radius r) along direction angle
// `a`. Used to place beads exactly on a rounded-rect's border for square
// and rectangle tokens.
function rect_boundary_t(a, hw, hh, r) =
  let(
    dx = (cos(a) == 0) ? 1e-9 : cos(a),
    dy = (sin(a) == 0) ? 1e-9 : sin(a),
    t_edge = min(hw / abs(dx), hh / abs(dy)),
    px = t_edge * dx,
    py = t_edge * dy,
    in_corner = (abs(px) > hw - r + 1e-6) && (abs(py) > hh - r + 1e-6)
  )
  !in_corner
    ? t_edge
    : let(
        cx = (dx >= 0 ? 1 : -1) * (hw - r),
        cy = (dy >= 0 ? 1 : -1) * (hh - r),
        b = dx * cx + dy * cy,
        c = cx * cx + cy * cy - r * r,
        disc = max(0, b * b - c)
      ) b + sqrt(disc);

function bead_point(a, hw, hh, r, is_round) =
  is_round ? [hw * cos(a), hh * sin(a)] : (rect_boundary_t(a, hw, hh, r) * [cos(a), sin(a)]);

module beaded_ring_2d(inset) {
  is_round = (token_shape == "circle" || token_shape == "oval");
  hw = token_size / 2 - inset - bead_size / 2 + BORDER_EDGE_EPS;
  hh = token_effective_length() / 2 - inset - bead_size / 2 + BORDER_EDGE_EPS;
  r = max(0, min(corner_radius, token_min_side() / 2) - inset - bead_size / 2);

  for (i = [0 : bead_count - 1]) {
    a = i * 360 / bead_count;
    translate(bead_point(a, hw, hh, r, is_round))
      circle(d = bead_size, $fn = 20); // beads are small - high $fn just slows down CSG for no visible gain
  }
}

module border_2d() {
  if (border_style == "single") {
    ring_2d(border_inset, border_width);
  } else if (border_style == "double") {
    union() {
      ring_2d(border_inset, border_width);
      ring_2d(border_inset + border_width + border_gap, border_width);
    }
  } else if (border_style == "beaded") {
    beaded_ring_2d(border_inset);
  }
}

// ---------------------------------------------------------------------
// Back label (a short identifier etched into the bed-facing side, so
// physical prints of different settings can be told apart)
// ---------------------------------------------------------------------

VERSION_LABEL_DEPTH = 0.4; // mm - shallow: identification only, not a structural feature

module version_label_2d() {
  if (version_label != "") {
    label_len = len(version_label);
    // Caps the glyph height so even a full 16-character label stays
    // within ~70% of the coin's own diameter, on top of the usual
    // size-vs-coin scaling - 0.6 is a rough average character-width-to-
    // height ratio for a bold sans font, good enough to avoid overflow
    // without measuring actual glyph metrics.
    text_size = min(token_min_side() * 0.12, 3, (token_min_side() * 0.7) / max(1, label_len * 0.6));
    // Mirrored so the label reads correctly once the printed coin is
    // physically turned over left-to-right (as opposed to flipped top-
    // to-bottom) to view its back.
    mirror([1, 0, 0])
      text(version_label, size = text_size, halign = "center", valign = "center", font = "DejaVu Sans:style=Bold");
  }
}

module version_label_cut() {
  if (version_label != "") {
    depth = min(VERSION_LABEL_DEPTH, max(0, base_thickness - 0.2));
    linear_extrude(height = depth + 0.01) // +eps: guarantees a clean cut through the bottom face
      version_label_2d();
  }
}

module token_body() {
  if (svg_path != "" && relief_direction == "recessed") {
    // Carve the relief into the top face instead of adding to it - same
    // depth clamp as the border's own recessed cut below, so relief_height
    // can never carve a hole through the token. Unlike the raised relief,
    // this is a straight-walled cut (no draft-angle taper): the silicone
    // that fills it is flexible enough to release from a shallow vertical
    // pocket without one.
    recess_depth = min(relief_height, max(0, base_thickness - 0.2));
    difference() {
      linear_extrude(height = base_thickness)
        token_base_2d();
      translate([0, 0, base_thickness - recess_depth])
        linear_extrude(height = recess_depth + 0.01) // +eps: guarantees a clean cut through the top face
          svg_shape_positioned();
    }
  } else {
    union() {
      linear_extrude(height = base_thickness)
        token_base_2d();
      translate([0, 0, base_thickness])
        svg_relief_raised();
    }
  }
}

module token() {
  if (border_style != "none" && border_direction == "recessed") {
    // Carve the border into the top face rather than adding to it. Depth
    // is capped short of the full base thickness so a deep border_height
    // can never cut a hole through the token.
    recess_depth = min(border_height, max(0, base_thickness - 0.2));
    difference() {
      token_body();
      translate([0, 0, base_thickness - recess_depth])
        linear_extrude(height = recess_depth + 0.01) // +eps: guarantees a clean cut through the top face
          border_2d();
    }
  } else if (border_style != "none") {
    union() {
      token_body();
      translate([0, 0, base_thickness])
        linear_extrude(height = border_height)
          border_2d();
    }
  } else {
    token_body();
  }
}

module coin() {
  if (version_label != "") {
    difference() {
      token();
      version_label_cut();
    }
  } else {
    token();
  }
}

coin();
