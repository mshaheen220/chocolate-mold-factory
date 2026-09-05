#!/bin/sh
# Wraps the real `openscad` binary so it always renders under a virtual
# X server. OpenSCAD's CGAL/OpenCSG backend expects a display even for
# headless CLI renders, so every invocation is proxied through xvfb-run.
set -e
exec xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" openscad.real "$@"
