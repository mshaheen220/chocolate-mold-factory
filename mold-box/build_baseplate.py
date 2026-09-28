#!/usr/bin/env python3
"""Build a matching baseplate, box and gasket from a set of coin STLs.

    python3 mold-box/build_baseplate.py paw.stl panther.stl tecbio.stl cpcb.stl

Each coin is re-centred and dropped so its bottom sits at z = 0, which is
what makes it land flush on the plate. The grid cell is sized to the
largest coin and the box height to the tallest one. mold-box.scad makes
the plate, box and gasket; the coins are merged onto the plate here with
manifold3d, which copes with the slightly imperfect meshes slicers and
other tools export (OpenSCAD's own union rejects those). Coins fill the
grid left to right from the top row, in the order given. The baseplate is
checked to be one solid at the expected height before anything is
reported as done.

Needs openscad on PATH and: python3 -m pip install manifold3d trimesh numpy
Any mold-box.scad parameter can be overridden with --set name=value
(e.g. --set border_gap=8).
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


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("coins", nargs="+", help="coin STLs, in grid order")
    ap.add_argument("--grid", help="COLSxROWS, e.g. 2x2 (default: as square as possible)")
    ap.add_argument("--out-dir", default=".", help="where to write the STLs")
    ap.add_argument("--name", default="mold-box", help="output file prefix")
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
        "coin_thickness": tallest,
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

    print("Merging coins onto the plate...")
    plate_stl = os.path.join(tempfile.mkdtemp(prefix="mold-box-"), "plate.stl")
    spots = [tuple(map(float, m)) for m in
             re.findall(r'ECHO: "SPOT (\S+) (\S+)"', openscad(plate_stl, params, "plate"))]
    plate = to_manifold(trimesh.load(plate_stl, force="mesh"))
    placed = [solid.translate([x, y, plate_t - OVERLAP]) for (_, solid), (x, y) in zip(coins, spots)]
    result = mf.Manifold.batch_boolean([plate] + placed, mf.OpType.Add)

    # A label etched into a coin's back becomes a sealed void once the coin
    # sits on the plate. Those come back as negative-volume pieces; dropping
    # them fills the voids.
    parts = result.decompose()
    solids = [p for p in parts if p.volume() > 0]
    if len(parts) > len(solids):
        print(f"  Filled {len(parts) - len(solids)} sealed pocket(s) left by labels on the coins' backs")
    pieces = len(solids)
    if pieces == 1:
        result = solids[0]
    else:
        sys.exit(f"Merged baseplate is {pieces} separate pieces, expected 1 - a coin isn't touching the plate")
    top = result.bounding_box()[5]
    expected = plate_t + tallest - OVERLAP
    if abs(top - expected) > 0.05:
        sys.exit(f"Merged baseplate is {top:.2f} mm tall, expected {expected:.2f}")
    to_trimesh(result).export(out["baseplate"])

    for line in box_log.splitlines():
        if line.startswith("ECHO") and "SPOT" not in line:
            print("  " + line[6:].strip('"'))
    print(f"Baseplate checked: one solid, {top:.2f} mm tall, every coin flush on the plate.")
    for part, path in out.items():
        print(f"  {part}: {path}")


if __name__ == "__main__":
    main()
