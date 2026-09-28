// Reusable silicone mold box for chocolate coin masters.
//
// Standalone script (not used by the app): open it in OpenSCAD, set the
// parameters, pick a `part`, render, export STL. Three pieces:
//
//   box       - open-bottom sleeve with an internal ledge. Inner walls are
//               straight around the gasket + baseplate, then flare out by
//               draft_angle so the cured block pushes out the top.
//   gasket    - flat ring that sits on the ledge. Print in TPU.
//   baseplate - drops in on the gasket, with the coin masters merged into
//               it (coin_stl) so there's no seam for silicone to creep into.
//
// Workflow: gasket in, baseplate in, pour silicone. The silicone's weight
// presses the plate onto the gasket, which is the seal. Once cured, push up
// through the open bottom against the baseplate and the whole block slides
// out the top.
//
// Printing: the baseplate carries the coin faces, so print it with your
// master (high detail) settings. The box and gasket only need to hold: a
// 0.4 nozzle at a coarse layer height is fine, and the tolerances below
// assume that.

/* [What to render] */
part = "all"; // [all, box, gasket, baseplate]

/* [Coins] */
coin_width     = 45;  // X size of one coin's footprint (circle: diameter)
coin_length    = 45;  // Y size of one coin's footprint (circle: same as width)
coin_thickness = 4;   // total coin height incl. relief (base + relief)
grid_x         = 2;   // coins across
grid_y         = 2;   // coins down
coin_stl       = "";  // path to the app's coin STL, merged in at each grid spot

/* [Spacing] */
gap_between_coins      = 10; // coin edge to coin edge
border_gap             = 10; // outer coins to the box's inner wall
silicone_top_clearance = 8;  // top of coins to top of box = mold's back thickness

/* [Box] */
wall_thickness     = 2.4;
ledge_width        = 4;   // how far the ledge sticks in under the gasket
ledge_height       = 3;   // thickness of the ledge itself
inner_draft_angle  = 3;   // outward flare of the inner walls above the plate
baseplate_tolerance = 0.6; // total clearance (both sides) between plate and walls

/* [Gasket & Baseplate] */
gasket_thickness    = 1.5;
baseplate_thickness = 3;

/* [Layout] */
part_spacing = 10; // gap between parts when part = "all"

$fn = 96;

// ---------------------------------------------------------------------
// Derived sizes
// ---------------------------------------------------------------------

plate_x = grid_x * coin_width  + (grid_x - 1) * gap_between_coins + 2 * border_gap;
plate_y = grid_y * coin_length + (grid_y - 1) * gap_between_coins + 2 * border_gap;

// Straight-walled pocket the gasket and plate drop into.
pocket_x = plate_x + baseplate_tolerance;
pocket_y = plate_y + baseplate_tolerance;
pocket_h = gasket_thickness + baseplate_thickness;

// Drafted section from the top of the plate to the top of the box.
draft_h   = coin_thickness + silicone_top_clearance;
draft_out = draft_h * tan(inner_draft_angle); // per side
top_x     = pocket_x + 2 * draft_out;
top_y     = pocket_y + 2 * draft_out;

box_h   = ledge_height + pocket_h + draft_h;
outer_x = top_x + 2 * wall_thickness;
outer_y = top_y + 2 * wall_thickness;

// Hole under the ledge, for pushing the plate out.
opening_x = pocket_x - 2 * ledge_width;
opening_y = pocket_y - 2 * ledge_width;

// Upper bound on silicone: the drafted section, ignoring the coins' volume.
silicone_ml = draft_h * (pocket_x * pocket_y + top_x * top_y + sqrt(pocket_x * pocket_y * top_x * top_y)) / 3 / 1000;

echo(str("Baseplate: ", plate_x, " x ", plate_y, " mm"));
echo(str("Box outside: ", outer_x, " x ", outer_y, " x ", box_h, " mm"));
echo(str("Silicone needed: about ", round(silicone_ml), " mL (less the coins)"));

if (coin_stl == "" && part == "all") echo("WARNING: coin_stl is not set - the baseplate has no coins on it");
assert(opening_x > 0 && opening_y > 0, "ledge_width is too big for this plate");

// ---------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------

module rect(x, y, h) { translate([-x / 2, -y / 2, 0]) cube([x, y, h]); }

module box() {
  eps = 0.01;
  difference() {
    rect(outer_x, outer_y, box_h);
    // Push-out opening under the ledge.
    translate([0, 0, -eps]) rect(opening_x, opening_y, ledge_height + 2 * eps);
    // Gasket + plate pocket.
    translate([0, 0, ledge_height]) rect(pocket_x, pocket_y, pocket_h + eps);
    // Drafted section: scale the pocket outline up to the top size.
    translate([0, 0, ledge_height + pocket_h])
      linear_extrude(height = draft_h + eps, scale = [top_x / pocket_x, top_y / pocket_y])
        square([pocket_x, pocket_y], center = true);
  }
}

module gasket() {
  // Slightly under the pocket so it drops in without buckling.
  difference() {
    rect(pocket_x - 0.4, pocket_y - 0.4, gasket_thickness);
    translate([0, 0, -0.01]) rect(opening_x, opening_y, gasket_thickness + 0.02);
  }
}

function coin_center(i, j) = [
  -plate_x / 2 + border_gap + coin_width  / 2 + i * (coin_width  + gap_between_coins),
  -plate_y / 2 + border_gap + coin_length / 2 + j * (coin_length + gap_between_coins)
];

module baseplate() {
  rect(plate_x, plate_y, baseplate_thickness);
  if (coin_stl != "")
    for (i = [0 : grid_x - 1], j = [0 : grid_y - 1])
      translate([each coin_center(i, j), baseplate_thickness - 0.01]) // -eps: overlap so the union is one solid
        import(coin_stl);
}

// ---------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------

if (part == "box") box();
else if (part == "gasket") gasket();
else if (part == "baseplate") {
  assert(coin_stl != "", "Set coin_stl to the app's coin STL before exporting the baseplate");
  baseplate();
}
else if (part == "all") {
  box();
  translate([outer_x / 2 + part_spacing + pocket_x / 2, 0, 0]) gasket();
  translate([0, outer_y / 2 + part_spacing + plate_y / 2, 0]) baseplate();
}
