import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Billboard, Bounds, Grid, Line, Text, OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ViewerErrorBoundary } from "./ViewerErrorBoundary";

interface ModelProps {
  url: string;
  onSizeChange: (largestDimensionMm: number) => void;
}

function Model({ url, onSizeChange }: ModelProps) {
  const geometry = useLoader(STLLoader, url);

  const prepared = useMemo(() => {
    const geo = geometry.clone();
    geo.computeVertexNormals();
    // Every template extrudes upward from z=0 (its bottom face already
    // sits on the print bed) - geo.center() would recenter Z too,
    // sinking the model half its height below the floor grid. Center
    // only the horizontal footprint and anchor the bottom face at 0.
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerY = (box.min.y + box.max.y) / 2;
    geo.translate(-centerX, -centerY, -box.min.z);
    return geo;
  }, [geometry]);

  // Reporting the size is a side effect (updates parent state), so it
  // belongs in an effect, not inline in the useMemo above.
  useEffect(() => {
    prepared.computeBoundingBox();
    const box = prepared.boundingBox!;
    onSizeChange(Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z));
  }, [prepared, onSizeChange]);

  return (
    <mesh geometry={prepared} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#d9b98c" roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

/** Picks a "nice" tick spacing (mm) so labels stay readable regardless of
 * whether the model is a 20mm token or a 300mm mold box. */
function pickTickStep(largestDimensionMm: number): number {
  if (largestDimensionMm <= 30) return 5;
  if (largestDimensionMm <= 80) return 10;
  if (largestDimensionMm <= 200) return 25;
  return 50;
}

interface RulerProps {
  largestDimensionMm: number;
}

/**
 * World-space ruler ticks lying flat on the floor grid, with billboarded
 * (always-camera-facing) mm labels - a screen-space ruler bar (like a 2D
 * design tool) can't work here since the camera orbits freely in 3D and
 * pixel positions don't map to a fixed world distance.
 *
 * Laid out as an L along two edges offset outside the model's footprint
 * (like a carpenter's square at one corner) rather than crossing through
 * its center - a through-center crosshair puts inner tick labels right on
 * top of the model itself. Label/tick sizing is derived from the fixed
 * tick `step` (not the total ruler span), so text stays legible instead of
 * ballooning for models that just happen to need a wider ruler.
 */
function Ruler({ largestDimensionMm }: RulerProps) {
  const step = pickTickStep(largestDimensionMm);
  const modelHalf = largestDimensionMm / 2;
  const rulerOffset = modelHalf + step;
  const half = Math.ceil(modelHalf / step) * step + step;

  const ticks = useMemo(() => {
    const values: number[] = [];
    for (let d = -half; d <= half; d += step) values.push(d);
    return values;
  }, [half, step]);

  const tickLineColor = "#6f5137";
  const labelColor = "#c9a876";
  const labelSize = Math.min(6, Math.max(1.2, step * 0.28));
  const tickMarkLength = step * 0.18;
  const labelGap = tickMarkLength * 2.4;
  const y = 0.06;

  return (
    <group>
      {/* X-axis ruler, offset behind the model along -Z */}
      <Line points={[[-half, y, -rulerOffset], [half, y, -rulerOffset]]} color={tickLineColor} lineWidth={1} />
      {ticks.map((d) => (
        <group key={`x-${d}`}>
          <Line
            points={[
              [d, y, -rulerOffset - tickMarkLength],
              [d, y, -rulerOffset + tickMarkLength],
            ]}
            color={tickLineColor}
            lineWidth={1}
          />
          <Billboard position={[d, y, -rulerOffset - labelGap]}>
            <Text fontSize={labelSize} color={labelColor} anchorX="center" anchorY="middle">
              {d === 0 ? "0mm" : String(Math.abs(d))}
            </Text>
          </Billboard>
        </group>
      ))}

      {/* Z-axis ruler, offset beside the model along -X */}
      <Line points={[[-rulerOffset, y, -half], [-rulerOffset, y, half]]} color={tickLineColor} lineWidth={1} />
      {ticks
        .filter((d) => d !== 0)
        .map((d) => (
          <group key={`z-${d}`}>
            <Line
              points={[
                [-rulerOffset - tickMarkLength, y, d],
                [-rulerOffset + tickMarkLength, y, d],
              ]}
              color={tickLineColor}
              lineWidth={1}
            />
            <Billboard position={[-rulerOffset - labelGap, y, d]}>
              <Text fontSize={labelSize} color={labelColor} anchorX="center" anchorY="middle">
                {String(Math.abs(d))}
              </Text>
            </Billboard>
          </group>
        ))}
    </group>
  );
}

interface STLViewerProps {
  url: string | null;
}

export function STLViewer({ url }: STLViewerProps) {
  // Drives both the ruler's tick spacing and the floor grid's cell size,
  // so the two stay visually consistent. Keeps a sane default before any
  // model has loaded.
  const [modelSize, setModelSize] = useState(80);
  const step = pickTickStep(modelSize);

  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [90, 90, 90], fov: 40 }}>
        <color attach="background" args={["#150d09"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[120, 180, 100]} intensity={1.1} castShadow />
        <directionalLight position={[-100, 40, -80]} intensity={0.25} />
        <ViewerErrorBoundary key={url} fallback={null}>
          <Suspense fallback={null}>
            {url && (
              <Bounds fit clip observe margin={1.3}>
                <Model url={url} onSizeChange={setModelSize} />
              </Bounds>
            )}
          </Suspense>
        </ViewerErrorBoundary>
        <Grid
          args={[300, 300]}
          position={[0, -0.01, 0]}
          cellSize={step}
          sectionSize={step * 5}
          cellColor="#3a2a20"
          sectionColor="#5a4132"
          fadeDistance={250}
          infiniteGrid
        />
        <Ruler largestDimensionMm={modelSize} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      </Canvas>
      {!url && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-cocoa-400">
          Configure parameters and click Generate / Preview to render a model here.
        </div>
      )}
    </div>
  );
}
