import {
  TorusKnotBufferGeometry,
  Scene,
  LinearFilter,
  RGBFormat,
  WebGLRenderTarget,
  Mesh,
  ShaderMaterial,
  MeshStandardMaterial,
  Object3D,
  BufferGeometry,
  Plane,
  IncrementWrapStencilOp,
  DecrementStencilOp,
  AlwaysStencilFunc,
  BackSide,
  FrontSide,
  WebGLRenderer,
  DoubleSide,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  Vector3,
	MeshBasicMaterial,
} from "three";
import { useControls, folder } from "leva";
import { CappingPlanes } from "./CappingPlanes";
import {
  Plane as PlaneBufferGeometry,
  OrbitControls,
  Html,
} from "@react-three/drei";
import React, { FC, useState, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";

export const ExampleClipModel = () => {

  const [torusKnotBufferGeom] = useState(new TorusKnotBufferGeometry());
  const torusKnotBufferGeomRef = useRef<TorusKnotBufferGeometry>(
    torusKnotBufferGeom
  );

	const [meshBasicMaterial] = useState(new MeshBasicMaterial())
	const meshBasicMaterialRef = useRef(meshBasicMaterial);

	meshBasicMaterialRef.current.onBeforeCompile =  function ( shader ) {

	};


  const { z_constant, x_constant, y_constant } = useControls(
    "clipping height",
    {
      x_constant: { value: 0, min: -10, max: 10 },
      y_constant: { value: 0, min: -10, max: 10 },
      z_constant: { value: 0, min: -10, max: 10 },
    }
  );

  const clipPlanes = [
    new Plane(new Vector3(-1, 0, 0), x_constant),
    new Plane(new Vector3(0, -1, 0), y_constant),
    new Plane(new Vector3(0, 0, -1), z_constant),
  ];

  return (
    <group>
      <planeHelper plane={clipPlanes[0]} />
      <planeHelper plane={clipPlanes[1]} />
      <planeHelper plane={clipPlanes[2]} />

      <mesh 
				geometry={torusKnotBufferGeomRef.current}>
        <meshBasicMaterial
					ref={meshBasicMaterialRef}
          attach="material"
          color="hotpink"
          clippingPlanes={clipPlanes}
					/>
      </mesh>

      <CappingPlanes
        planes={clipPlanes}
        inputGeometry={torusKnotBufferGeomRef.current}
        renderOrder={2}
      />
    </group>
  );
};

const SceneImpl: FC<{}> = () => {
  return (
    <>
      <ambientLight />
      <ExampleClipModel />
    </>
  );
};

export interface ClippingCapProps {}

export const ClippingCap: FC<ClippingCapProps> = ({}) => {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
      }}
    >
      <Canvas
        onCreated={({ camera, gl }) => {
          camera.position.set(6, 18, 6);
          camera.lookAt(0, 4, 0);
          camera.updateProjectionMatrix();
          gl.localClippingEnabled = true;
        }}
      >
				<axesHelper/>
        <Suspense
          fallback={
            <Html>
              <div>Loading...</div>
            </Html>
          }
        >
          <SceneImpl />
        </Suspense>
        <OrbitControls />
      </Canvas>
    </div>
  );
};