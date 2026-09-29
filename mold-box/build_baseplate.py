#!/usr/bin/env python3
"""Build a matching baseplate, box and gasket from a set of coin STLs.

    python3 mold-box/build_baseplate.py paw.stl panther.stl tecbio.stl cpcb.stl

By default the baseplate gets a shallow pocket per coin, traced from that
coin's own base outline, so coins you've already printed drop in and get
glued. Glue in the pocket wicks into the tight gap and seals it. A coin
sinks by the pocket depth, so its molded base is that much thinner.

  --brim-width W   coins printed with a W mm brim (brim-object gap 0):
                   pockets follow the brim so it sits flush; pass the brim's
                   thickness (your first layer) as --pocket-depth. Widen
                   gap_between_coins by 2 x W so neighbouring brims fit.
  --merged         merge the coins into the plate instead (one print, no
                   glue, but the whole plate prints at coin quality).

Coins are re-centred and fill the grid left to right from the top row, in
the order given. The grid cell is sized to the largest coin and the box
height to the tallest. mold-box.scad makes the plate, box and gasket; the
pockets and merges are done here with manifold3d, which copes with the
slightly imperfect meshes slicers export (OpenSCAD's own CSG rejects
those). The plate is checked (one solid; every coin seats in its pocket
without touching the walls, or sits flush when merged) before anything is
reported as done.

Needs openscad on PATH and: python3 -m pip install manifold3d trimesh numpy
Any mold-box.scad parameter can be overridden with --set name=value
(e.g. --set border_gap=6).
"""

import argparse
import math
import os
import re
import subprocess
import sys
import tempfile

try:
    import manifold3d as mf
    import numpy as np
    import trimesh
except ImportError:
    sys.exit("Missing libraries: python3 -m pip install manifold3d trimesh numpy")

HERE = os.path.dirname(os.path.abspath(__file__))
SCAD = os.path.join(HERE, "mold-box.scad")
OVERLAP = 0.01  # coins sink this far into the plate so the union is one solid


def load_coin(path):
    """Load, clean, centre on X/Y and drop to z = 0."""
    mesh = trimesh.load(path, force="mesh")
    mesh.merge_vertices(digits_vertex=4)
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    (x0, y0, z0), (x1, y1, _) = mesh.bounds
    mesh.apply_translation([-(x0 + x1) / 2, -(y0 + y1) / 2, -z0])
    solid = to_manifold(mesh)
    if solid.status() != mf.Error.NoError:
        sys.exit(f"{path}: mesh can't be made solid ({solid.status()}); re-export it and try again")
    return mesh, solid


def to_manifold(mesh):
    return mf.Manifold(mf.Mesh(
        vert_properties=np.asarray(mesh.vertices, dtype=np.float32),
        tri_verts=np.asarray(mesh.faces, dtype=np.uint32)))


def to_trimesh(solid):
    m = solid.to_mesh()
    return trimesh.Trimesh(vertices=m.vert_properties[:, :3], faces=m.tri_verts)


def scad_value(v):
    if isinstance(v, str):
        return '"' + v + '"'
    return repr(round(float(v), 3))


def openscad(out, params, part):
    cmd = ["openscad", "-o", out, "-D", f'part="{part}"']
    for k, v in params.items():
        cmd += ["-D", f"{k}={scad_value(v)}"]
    cmd.append(SCAD)
    res = subprocess.run(cmd, capture_output=True, text=True)
    log = res.stdout + res.stderr
    if res.returncode != 0 or not os.path.exists(out):
        sys.exit(f"openscad failed on {part}:\n{log}")
    return log


def footprint(solid, z=0.8):
    """Outline of the coin's base, from a slice just above the bottom (so a
    label etched into the back doesn't punch holes in it, and relief that
    overhangs the edge doesn't widen it)."""
    polys = solid.slice(z).to_polygons()
    def area(p):
        return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(p, np.roll(p, -1, axis=0)))
    return mf.CrossSection([p for p in polys if area(p) > 0])


def pocket_plate(plate, coins, spots, plate_t, depth, clearance, brim):
    """Cut a pocket per coin, traced from the coin's own outline (plus its
    brim, when the coins keep theirs)."""
    print("Cutting pockets into the plate...")
    cutters = []
    for (_, solid), (x, y) in zip(coins, spots):
        outline = footprint(solid).offset(brim + clearance, mf.JoinType.Round)
        cutters.append(mf.Manifold.extrude(outline, depth + 1).translate([x, y, plate_t - depth]))
    result = plate - mf.Manifold.batch_boolean(cutters, mf.OpType.Add)

    # Check: still one piece, each pocket took out material, and every coin
    # seats at the pocket floor without touching the plate anywhere else.
    if len(result.decompose()) != 1:
        sys.exit("Pocket plate came out in more than one piece - pockets overlap or cut through")
    for i, ((_, solid), (x, y)) in enumerate(zip(coins, spots)):
        seated = solid.translate([x, y, plate_t - depth + OVERLAP])
        clash = (seated ^ result).volume()
        if clash > 0.01:
            sys.exit(f"Coin {i + 1} doesn't fit its pocket ({clash:.2f} mm3 overlap)")
    what = f"brim pockets {brim} mm wide" if brim else "pockets"
    return result, (f"Pocket plate checked: one solid, {len(coins)} {what} {depth} mm deep, "
                    f"{clearance} mm clearance per side, every coin seats without touching the walls.")


def merged_plate(plate, coins, spots, plate_t, tallest):
    """Union the coins onto the plate so the whole thing prints as one."""
    print("Merging coins onto the plate...")
    placed = [solid.translate([x, y, plate_t - OVERLAP]) for (_, solid), (x, y) in zip(coins, spots)]
    result = mf.Manifold.batch_boolean([plate] + placed, mf.OpType.Add)

    # A label etched into a coin's back becomes a sealed void once the coin
    # sits on the plate. Those come back as negative-volume pieces; dropping
    # them fills the voids.
    parts = result.decompose()
    solids = [p for p in parts if p.volume() > 0]
    if len(parts) > len(solids):
        print(f"  Filled {len(parts) - len(solids)} sealed pocket(s) left by labels on the coins' backs")
    if len(solids) != 1:
        sys.exit(f"Merged baseplate is {len(solids)} separate pieces, expected 1 - a coin isn't touching the plate")
    result = solids[0]
    top = result.bounding_box()[5]
    expected = plate_t + tallest - OVERLAP
    if abs(top - expected) > 0.05:
        sys.exit(f"Merged baseplate is {top:.2f} mm tall, expected {expected:.2f}")
    return result, f"Baseplate checked: one solid, {top:.2f} mm tall, every coin flush on the plate."


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("coins", nargs="+", help="coin STLs, in grid order")
    ap.add_argument("--grid", help="COLSxROWS, e.g. 2x2 (default: as square as possible)")
    ap.add_argument("--out-dir", default=".", help="where to write the STLs")
    ap.add_argument("--name", default="mold-box", help="output file prefix")
    ap.add_argument("--merged", action="store_true",
                    help="merge the coins into the plate (reprints them) instead of cutting pockets")
    ap.add_argument("--pocket-depth", type=float, default=0.6, help="mm (default 0.6)")
    ap.add_argument("--pocket-clearance", type=float, default=0.15,
                    help="gap per side between coin and pocket wall, mm (default 0.15)")
    ap.add_argument("--brim-width", type=float, default=0,
                    help="coins were printed with a brim this wide (mm): pockets follow the brim, "
                         "and --pocket-depth should be the brim's thickness (your first layer)")
    ap.add_argument("--set", action="append", default=[], metavar="NAME=VALUE",
                    help="override a mold-box.scad parameter")
    args = ap.parse_args()

    n = len(args.coins)
    if args.grid:
        cols, rows = (int(x) for x in args.grid.lower().split("x"))
    else:
        cols = math.ceil(math.sqrt(n))
        rows = math.ceil(n / cols)
    if cols * rows < n:
        sys.exit(f"--grid {cols}x{rows} has room for {cols * rows} coins, got {n}")

    coins = []
    for path in args.coins:
        mesh, solid = load_coin(path)
        w, l, h = mesh.extents
        print(f"  {os.path.basename(path)}: {w:.1f} x {l:.1f} mm, {h:.2f} mm tall")
        coins.append((mesh, solid))
    tallest = max(m.extents[2] for m, _ in coins)

    params = {
        "grid_x": cols,
        "grid_y": rows,
        "coin_width": max(m.extents[0] for m, _ in coins),
        "coin_length": max(m.extents[1] for m, _ in coins),
        # In pockets the coins sit lower, so the box needs less height.
        "coin_thickness": tallest - (0 if args.merged or args.brim_width else args.pocket_depth),
    }
    for item in args.set:
        k, _, v = item.partition("=")
        v = v.strip()
        params[k.strip()] = float(v) if re.fullmatch(r"-?[\d.]+", v) else v
    plate_t = float(params.get("baseplate_thickness", 3))

    os.makedirs(args.out_dir, exist_ok=True)
    out = {p: os.path.join(args.out_dir, f"{args.name}-{p}.stl") for p in ("baseplate", "box", "gasket")}

    print("Rendering box and gasket...")
    box_log = openscad(out["box"], params, "box")
    openscad(out["gasket"], params, "gasket")

    plate_stl = os.path.join(tempfile.mkdtemp(prefix="mold-box-"), "plate.stl")
    spots = [tuple(map(float, m)) for m in
             re.findall(r'ECHO: "SPOT (\S+) (\S+)"', openscad(plate_stl, params, "plate"))]
    plate = to_manifold(trimesh.load(plate_stl, force="mesh"))
    if args.merged:
        result, summary = merged_plate(plate, coins, spots, plate_t, tallest)
    else:
        result, summary = pocket_plate(plate, coins, spots, plate_t, args.pocket_depth,
                                       args.pocket_clearance, args.brim_width)
    to_trimesh(result).export(out["baseplate"])

    for line in box_log.splitlines():
        if line.startswith("ECHO") and "SPOT" not in line:
            print("  " + line[6:].strip('"'))
    print(summary)
    for part, path in out.items():
        print(f"  {part}: {path}")


if __name__ == "__main__":
    main()
