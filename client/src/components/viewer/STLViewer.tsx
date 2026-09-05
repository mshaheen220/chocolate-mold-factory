import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ViewerErrorBoundary } from "./ViewerErrorBoundary";

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);

  const prepared = useMemo(() => {
    const geo = geometry.clone();
    geo.computeVertexNormals();
    geo.center();
    return geo;
  }, [geometry]);

  return (
    <mesh geometry={prepared} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#d9b98c" roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

interface STLViewerProps {
  url: string | null;
}

export function STLViewer({ url }: STLViewerProps) {
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
                <Model url={url} />
              </Bounds>
            )}
          </Suspense>
        </ViewerErrorBoundary>
        <Grid
          args={[300, 300]}
          position={[0, -0.01, 0]}
          cellColor="#3a2a20"
          sectionColor="#5a4132"
          fadeDistance={250}
          infiniteGrid
        />
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
