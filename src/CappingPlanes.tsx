/* eslint-disable */
import React, { FC , useRef, useEffect, useState, useMemo} from "react";
import { Plane as PlaneBufferGeometry } from "@react-three/drei";
import {
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
  Matrix4,
  Quaternion,
  Vector3,
  Euler,
	Vector4,
	Mesh,
	Object3D,
	ShaderMaterial
} from "three";
import glsl from 'glslify'; 


/**
 * sources: 
 * - https://www.ronja-tutorials.com/post/021-plane-clipping/
 * 
 *  equation of plane is: 
 * 	𝐧 ⋅ (𝐫−𝐫₀) = 0  , 
 * 	where 
 * 			𝐧 = [𝐱₁ 𝐱₂ 𝐱₃], the normal vector of the plane, 
 * 			𝐫₀= k 𝐧, were k is the offset of the plane from the origin, and n is the normal vector
 * 			𝐫 is a generic coordinate in world space
 * 
 *	The equation roughly translatetes to: (𝐫−𝐫₀) will be a vector in the 'plane' if (𝐫−𝐫₀) is perpendicular to the normal vector of the plane, 𝐧. 
		The dot product: 𝐱 ⋅ 𝐲= |𝐱||𝐲| cos θ means that 
		-> if the point is on the plane, θ=90 degrees => cos θ = 0. 
		-> if the point is above the plane => 0 < θ < 90 degrees => 0 < cos θ < 1
		-> if the point is below the plane => 90 < θ < 180 degrees => -1 < cos θ < 0
 */







// we create a very simple material for our 'phantom' modules. We use the 'shaderMaterial' which injects
// various uniforms for free

const clippingCapVertexShader =  glsl`
		
		// 💉 injected uniforms: <- injected as a matter of course by three.js. 
		// uniform mat4 modelMatrix; ✅ 			// = object.matrixWorld
		// uniform mat4 modelViewMatrix; ✅ 	// = camera.matrixWorldInverse * object.matrixWorld
		// uniform mat4 projectionMatrix; ✅ 	// = camera.projectionMatrix
		// uniform mat4 viewMatrix; ✅				// = camera.matrixWorldInverse
		// uniform mat3 normalMatrix; ✅			// = inverse transpose of modelViewMatrix
		// uniform vec3 cameraPosition; ✅		// = camera position in world space
		
	
		// uniform vec4 uClippingPlanes[3];
		
		//  💉 injected buffer geometry attributes: <- from inspecing the gltf file, we know the ✅ attributes will be parsed in by the gltf loader
		// attribute vec3 position; //POSITION ✅
		// attribute vec3 normal; //NORMAL
		// attribute vec3 tangent; //TANGENT
		// attribute vec2 uv; //TEXCOORD_0
		// attribute vec2 uv2; //TEXCOORD_1
		// attribute vec4 color; //COLOR_0 
		// attribute vec3 skinWeight; //WEIGHTS_0
		// attribute vec3 skinIndex; //JOINTS_0
		
		varying vec3 vCameraPosition; 
		varying vec4 vWorldSpaceCoordinates; 
		varying vec4 vViewSpaceCoordinates; 

		varying vec3 vClipPosition;
	

	void main() {

		vCameraPosition = cameraPosition; 
		// vWorldSpaceCoordinates: coordinates w.r.t world space. 'modelMatrix' transforms from local to world space
		vWorldSpaceCoordinates = modelMatrix * vec4( position, 1.0 );
		//																							^ position: coordinates w.r.t local/model space
		// vViewSpaceCoordinates: coodinates w.r.t camera space
		vViewSpaceCoordinates = viewMatrix * vWorldSpaceCoordinates; 

		// gl_Position: coordinates w.r.t homogenous space
		gl_Position = projectionMatrix * vViewSpaceCoordinates; 



	}`


	const clippingCapFragmentShader = glsl`
	
		
		// 💉 injected uniforms: <- injected as a matter of course by three.js. 
		// uniform mat4 modelMatrix; ✅ 			// = object.matrixWorld
		// uniform mat4 modelViewMatrix; ✅ 	// = camera.matrixWorldInverse * object.matrixWorld
		// uniform mat4 projectionMatrix; ✅ 	// = camera.projectionMatrix
		// uniform mat4 viewMatrix; ✅				// = camera.matrixWorldInverse
		// uniform mat3 normalMatrix; ✅			// = inverse transpose of modelViewMatrix
		// uniform vec3 cameraPosition; ✅		// = camera position in world space
		

		varying vec3 vCameraPosition;
		varying vec4 vWorldSpaceCoordinates; 
		varying vec4 vViewSpaceCoordinates; 
		varying vec4 vClipSpaceCoordinates; 

		uniform vec4 uClippingPlanes[3];

	
		void main() {

			vec4 plane;
			vec3 plane_origin_to_point;
			vec3 plane_origin_to_camera_position; 

			#pragma unroll_loop_start
			for ( int i = 0; i < 3; i ++ ) {
				plane = uClippingPlanes[ i ];
				//														↓ had to add '-' because of way clipping planes are defined in the three.js shaders: see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/clipping_planes_vertex.glsl.js
				plane_origin_to_point = vec3(-vWorldSpaceCoordinates.xyz - plane.w * plane.xyz);
				plane_origin_to_camera_position = vec3(-cameraPosition.xyz - plane.w * plane.xyz); 
				//			↓ vertex is on the non excluded side of the clipping plane   ↓ the clipping plane is facing the camera								
				if ( dot( plane.xyz, plane_origin_to_point ) > 0.0 &&  dot( plane.xyz, plane_origin_to_camera_position) > 0.0) discard;
			}
			


			gl_FragColor = vec4(vWorldSpaceCoordinates.xyz, 1.0);
			
			

		}
		
		`; 



/**
 When there is just one clipping plane on an otherwise closed mesh and backface rendering is enabled, 
 then there are backsides visible through the whole opening. Rendered into a stencil this area can be used 
 to define where to render the caps. 
 
 First a scene showing only the backfaces is used to increment the stencil and then another scene showing 
 the front faces decrements the stencil. The resulting stencil is applied to a scene rendering a plane at 
 the location of the clipping plane
 But this method fails when there is more than one clipping plane. Because clipping planes facing away from the 
 camera result in hidden backfaces, these areas are missing in the stencil
 The solution is to use a different shader for rendering the stencil areas, that only clipps at clipping planes 
 facing the camera. Since the camera position is known it can be calculated in the shader whether a clipping plane 
 is facing towards the camera or away from it
 */

type CappingPlanesProps = {
  inputGeometry: BufferGeometry;
  planes: Plane[];
  renderOrder: number;
};

// in parallel to rendering the scene proper, we also want to render the scene objects into a scencil buffer, and then
// use the stencil buffer to facillitate the drawing of capping planes to the section cuts.
export const CappingPlanes: FC<CappingPlanesProps> = ({
  inputGeometry,
  planes,
  renderOrder,
}) => {
  const afterRender = (renderer: WebGLRenderer) => {
    renderer.clearStencil();
  };

	const [shaderMaterial] = useState(new ShaderMaterial())
	const shaderMaterialRef = useRef<ShaderMaterial>(shaderMaterial)


	// convert planes to a type that can be parsed into a three.j shader (i.e. Vector4 -> vec4)
	const vec4Planes: Vector4[] = planes.map((plane: Plane) => {
		const { x, y, z} = plane.normal; 
		return new Vector4(x, y, z, plane.constant)
	})

	const uniforms = useMemo(() =>{
		return {
			"uClippingPlanes": {value: vec4Planes}
		}
	},[])

	/**
	 * We drive ui behaviour by dynamically changing the unfiforms that we give to the
	 * shaders. This seems to be very slow. Fairly difficult to force three.js to update
	 * shader uniforms - perhaps uniforms are cached?
	 */


	useEffect(() => {
		shaderMaterialRef.current.uniforms.uClippingPlanes.value = vec4Planes; 
		shaderMaterialRef.current.needsUpdate = true;
	}, [planes])


  return (
    <group onAfterRender={afterRender}>
      {/** Stencil operations  */}

      <mesh 
			renderOrder={renderOrder} 
			geometry={inputGeometry}
			>
        <shaderMaterial
				ref={shaderMaterialRef}
				uniforms={uniforms}
				vertexShader={clippingCapVertexShader}
				fragmentShader={clippingCapFragmentShader}
				depthWrite={false}
				depthTest={false}
				colorWrite={false} // false
				stencilWrite={true}
				stencilFunc={AlwaysStencilFunc}
				side={BackSide}
				stencilFail={IncrementWrapStencilOp}
				stencilZFail={IncrementWrapStencilOp}
				stencilZPass={IncrementWrapStencilOp}
        />
      </mesh>
      <mesh 
		renderOrder={renderOrder} 
		geometry={inputGeometry}>
        <shaderMaterial
					uniforms={uniforms}					
					vertexShader={clippingCapVertexShader}
					fragmentShader={clippingCapFragmentShader}
					depthWrite={false}
					depthTest={false}
					colorWrite={false} // false
					stencilWrite={true}
					stencilFunc={AlwaysStencilFunc}
					side={FrontSide}
					stencilFail={DecrementStencilOp}
					stencilZFail={DecrementStencilOp}
					stencilZPass={DecrementStencilOp}
        />
      </mesh>

      {/** Planes  */}
      {planes.map((plane: Plane, index) => {

				const [mesh] = useState(new Mesh())
				const meshRef = useRef<Mesh>(mesh)

        return (
					<mesh
						key={`plane-${index}`}
						ref={meshRef}
						renderOrder={renderOrder + 2}
						position-z={plane.normal.z != 0 ? plane.constant: 0}
						rotation-x={plane.normal.y != 0 ? Math.PI/2: 0}
						position-x={plane.normal.x != 0 ? plane.constant: 0}
						rotation-y={plane.normal.x != 0 ? Math.PI/2: 0}
						position-y={plane.normal.y != 0 ? plane.constant: 0}
					>
					
					<planeBufferGeometry
					// default direction is normal in z direction
						args={[10, 10]} // width: along x axis ; height: along y axis
					/>
          <meshStandardMaterial
              color={0xe91e63}
              side={DoubleSide}
              stencilWrite={true}
              stencilRef={0}
              stencilFunc={NotEqualStencilFunc}
              stencilFail={ReplaceStencilOp}
              stencilZFail={ReplaceStencilOp}
              stencilZPass={ReplaceStencilOp}
          />
					</mesh>
        );
      })}
    </group>
  );
};


