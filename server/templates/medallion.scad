// Workflow A: 2D Graphic to Chocolate Tokens (Medallions)
// All variables below are overridden at compile time via `-D name=value`
// from the backend. Defaults here only matter when opening this file
// directly in the OpenSCAD GUI for template development.

/* [Render] */
render_mode = "single_token"; // single_token | tokens_2x2 | reusable_mold_box | adjustable_frame_strip | adjustable_frame_batch | adjustable_frame_preview
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

/* [Piece Geometry] */
token_shape    = "circle"; // circle | square | oval | rectangle
token_size     = 40;       // width: circle diameter / square side / oval X-diameter / rectangle width
token_length   = 60;       // length (Y axis): only used by oval & rectangle; ignored for circle/square
corner_radius  = 4;        // rounding for square & rectangle corners
base_thickness = 3;
relief_height  = 1.5;
draft_angle    = 3;

/* [Raised Border] */
border_style  = "none"; // none | single | double | beaded
border_inset  = 3;      // distance from the token's outer edge to the border
border_width  = 1.6;    // thickness of each border line (single & double)
border_gap    = 1.2;    // gap between the two lines (double only)
border_height = 0.8;    // how far the border rises above the token face
bead_count    = 24;     // number of individual beads around the perimeter (beaded only)
bead_size     = 2.5;    // diameter of each bead (beaded only)

/* [Mold Box Dimensions] */
grid_x         = 2;
grid_y         = 2;
spacing        = 5;
outer_margin   = 8;
silicone_depth = 6;  // reusable_mold_box: total internal height of the silicone pour
                      // adjustable_frame_*: height of each L-strip's wall
box_wall_th    = 4;  // reusable_mold_box: wall thickness / adjustable_frame_*: strip wall thickness
box_floor_th   = 3;  // reusable_mold_box: floor thickness / adjustable_frame_*: strip foot thickness

/* [Adjustable Mold Frame] */
// A reusable alternative to reusable_mold_box: print a handful of straight
// L-profile wall strips once, then build a box of almost any size by
// overlapping them at the corners and clamping with binder clips - no need
// to reprint a new box for every grid layout. Reuses box_wall_th (wall
// thickness), box_floor_th (foot thickness) and silicone_depth (wall
// height) from the section above.
frame_flange_width = 10;  // width of the outward foot/flange where binder clips grip each corner
frame_strip_length = 160; // length of each printed strip
frame_batch_count  = 4;   // number of strips to lay out together for one print job

$fn = 96;

// ---------------------------------------------------------------------
// Token base shape & relief
// ---------------------------------------------------------------------

function token_effective_length() =
  (token_shape == "oval" || token_shape == "rectangle") ? token_length : token_size;

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
  hw = token_size / 2 - inset - bead_size / 2;
  hh = token_effective_length() / 2 - inset - bead_size / 2;
  r = max(0, corner_radius - inset - bead_size / 2);

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

module token() {
  union() {
    linear_extrude(height = base_thickness)
      token_base_2d();
    translate([0, 0, base_thickness])
      svg_relief();
    if (border_style != "none") {
      translate([0, 0, base_thickness])
        linear_extrude(height = border_height)
          border_2d();
    }
  }
}

// ---------------------------------------------------------------------
// Token grid & pour-dam mold box
// ---------------------------------------------------------------------

function grid_extent(count, size) = count * size + (count - 1) * spacing;

module token_grid() {
  len_y = token_effective_length();
  step_x = token_size + spacing;
  step_y = len_y + spacing;
  half_w = grid_extent(grid_x, token_size) / 2;
  half_h = grid_extent(grid_y, len_y) / 2;

  for (ix = [0 : grid_x - 1])
    for (iy = [0 : grid_y - 1])
      translate([
        -half_w + token_size / 2 + ix * step_x,
        -half_h + len_y / 2 + iy * step_y,
        0,
      ])
        token();
}

function grid_footprint_w() = grid_extent(grid_x, token_size);
function grid_footprint_h() = grid_extent(grid_y, token_effective_length());

// A pour-dam box: the token grid sits on the floor, surrounded by a wall
// tall enough to hold a `silicone_depth` layer of RTV silicone above the
// relief. Removing the printed master after curing leaves a reusable
// silicone mold with the token cavities.
module mold_box() {
  inner_w = grid_footprint_w() + 2 * outer_margin;
  inner_h = grid_footprint_h() + 2 * outer_margin;
  outer_w = inner_w + 2 * box_wall_th;
  outer_h = inner_h + 2 * box_wall_th;
  wall_height = box_floor_th + base_thickness + relief_height + silicone_depth;

  union() {
    difference() {
      linear_extrude(height = wall_height)
        square([outer_w, outer_h], center = true);
      translate([0, 0, box_floor_th])
        linear_extrude(height = wall_height)
          square([inner_w, inner_h], center = true);
    }
    translate([0, 0, box_floor_th])
      token_grid();
  }
}

// ---------------------------------------------------------------------
// Adjustable mold frame: reusable L-profile wall strips
// ---------------------------------------------------------------------

// An L-beam: a vertical wall (box_wall_th x silicone_depth) with an
// outward foot/flange (frame_flange_width x box_floor_th) running its
// full length. Printed flat with the foot against the bed - no supports
// needed. Four of these, overlapped at right angles and held with binder
// clips, form a mold box of (almost) any size without reprinting.
module frame_strip_solid(length) {
  union() {
    cube([length, box_wall_th, silicone_depth]);
    translate([0, -frame_flange_width, 0])
      cube([length, frame_flange_width + box_wall_th, box_floor_th]);
  }
}

module frame_batch() {
  strip_footprint = box_wall_th + frame_flange_width;
  gap = 5;
  for (i = [0 : frame_batch_count - 1])
    translate([0, i * (strip_footprint + gap), 0])
      frame_strip_solid(frame_strip_length);
}

// Assembles four strips around the token grid's footprint so the whole
// mold box can be previewed before printing individual strips.
module adjustable_frame_preview() {
  // A small overlap at each corner (rather than an exact edge-to-edge
  // butt join) keeps the assembly a valid 2-manifold - and mirrors how the
  // real strips physically overlap where the binder clips grip.
  eps = 0.01;
  inner_w = grid_footprint_w() + 2 * outer_margin;
  inner_h = grid_footprint_h() + 2 * outer_margin;
  side_length = inner_w + 2 * box_wall_th;

  union() {
    translate([-side_length / 2, -inner_h / 2 - box_wall_th, 0])
      frame_strip_solid(side_length);

    translate([-side_length / 2, inner_h / 2, 0])
      frame_strip_solid(side_length);

    translate([-inner_w / 2 - box_wall_th, -inner_h / 2 - eps, 0])
      rotate([0, 0, 90])
        frame_strip_solid(inner_h + 2 * eps);

    translate([inner_w / 2, -inner_h / 2 - eps, 0])
      rotate([0, 0, 90])
        frame_strip_solid(inner_h + 2 * eps);

    token_grid();
  }
}

// ---------------------------------------------------------------------
// Render dispatch
// ---------------------------------------------------------------------

if (render_mode == "tokens_2x2") {
  token_grid();
} else if (render_mode == "reusable_mold_box") {
  mold_box();
} else if (render_mode == "adjustable_frame_strip") {
  frame_strip_solid(frame_strip_length);
} else if (render_mode == "adjustable_frame_batch") {
  frame_batch();
} else if (render_mode == "adjustable_frame_preview") {
  adjustable_frame_preview();
} else {
  token();
}
