// 2D Graphic to Chocolate Coin (single circular token, printed one at a time)
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
token_size     = 40;       // coin diameter
base_thickness = 3;
relief_height  = 1.5;
draft_angle    = 3;

/* [Border] */
border_style     = "none";  // none | single | double | beaded
border_direction = "raised"; // raised | recessed
border_inset     = 3;      // distance from the token's outer edge to the border
border_width     = 1.6;    // thickness of each border line (single & double)
border_gap       = 1.2;    // gap between the two lines (double only)
border_height    = 0.8;    // how far the border rises above (raised) or cuts into (recessed) the token face
bead_count       = 24;     // number of individual beads around the perimeter (beaded only)
bead_size        = 2.5;    // diameter of each bead (beaded only)

$fn = 96;

// ---------------------------------------------------------------------
// Token base shape & relief
// ---------------------------------------------------------------------

module token_base_2d() {
  circle(d = token_size);
}

// Extrudes the uploaded SVG as a relief with a draft-angle taper so it
// releases cleanly from a printed mold cavity.
module svg_shape_2d() {
  if (fast_preview) {
    hull() import(svg_path, center = true);
  } else {
    import(svg_path, center = true);
  }
}

module svg_relief() {
  if (svg_path != "") {
    taper_ratio = max(0.05, 1 - (2 * relief_height * tan(draft_angle) / token_size));
    linear_extrude(height = relief_height, scale = taper_ratio)
      translate([svg_offset_x, svg_offset_y])
        scale(svg_scale)
          svg_shape_2d();
  }
}

// ---------------------------------------------------------------------
// Raised border (single / double ring, or a beaded ring of dots)
// ---------------------------------------------------------------------

module ring_2d(inset, width) {
  difference() {
    offset(delta = -inset) token_base_2d();
    offset(delta = -(inset + width)) token_base_2d();
  }
}

module beaded_ring_2d(inset) {
  r = token_size / 2 - inset - bead_size / 2;

  for (i = [0 : bead_count - 1]) {
    a = i * 360 / bead_count;
    translate([r * cos(a), r * sin(a)])
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

module token_body() {
  union() {
    linear_extrude(height = base_thickness)
      token_base_2d();
    translate([0, 0, base_thickness])
      svg_relief();
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

token();
