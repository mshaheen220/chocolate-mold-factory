// Workflow B: Reusable Silicone Mold Box (Parametric Frame)
// All variables below are overridden at compile time via `-D name=value`
// from the backend. Defaults here only matter when opening this file
// directly in the OpenSCAD GUI for template development.

mold_inner_length_x = 80;
mold_inner_width_y  = 60;
mold_inner_depth_z  = 20;
wall_thickness      = 5;
floor_thickness     = 4;
draft_angle         = 3;
enable_center_guide = false;
guide_length_x      = 20;
guide_width_y       = 15;

$fn = 96;

// Cavity tapers outward from bottom to top so a cured silicone block (or a
// printed positive) releases without undercuts.
module cavity() {
  taper_x = 2 * mold_inner_depth_z * tan(draft_angle);
  taper_y = 2 * mold_inner_depth_z * tan(draft_angle);

  hull() {
    linear_extrude(height = 0.01)
      square([mold_inner_length_x, mold_inner_width_y], center = true);
    translate([0, 0, mold_inner_depth_z])
      linear_extrude(height = 0.01)
        square([mold_inner_length_x + taper_x, mold_inner_width_y + taper_y], center = true);
  }
}

// A raised locating boss standing up from the cavity floor, useful for
// keying a two-part pour or registering a second mold half.
module center_guide() {
  guide_height = mold_inner_depth_z * 0.3;
  linear_extrude(height = guide_height)
    square([guide_length_x, guide_width_y], center = true);
}

outer_l = mold_inner_length_x + 2 * wall_thickness;
outer_w = mold_inner_width_y + 2 * wall_thickness;
outer_h = floor_thickness + mold_inner_depth_z;

union() {
  difference() {
    linear_extrude(height = outer_h)
      square([outer_l, outer_w], center = true);

    translate([0, 0, floor_thickness])
      cavity();
  }

  if (enable_center_guide) {
    translate([0, 0, floor_thickness])
      center_guide();
  }
}
