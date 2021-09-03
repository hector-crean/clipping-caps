 #version 300 es
 #define varying in
 out highp vec4 pc_fragColor;
 #define gl_FragColor pc_fragColor
 #define gl_FragDepthEXT gl_FragDepth
 #define texture2D texture
 #define textureCube texture
 #define texture2DProj textureProj
 #define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
precision highp float;
precision highp int;
#define HIGH_PRECISION
#define SHADER_NAME ShaderMaterial
#define GAMMA_FACTOR 2
#define FLIP_SIDED
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
#define TONE_MAPPING
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return toneMappingExposure * color;
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
vec3 CustomToneMapping( vec3 color ) { return color; }
vec3 toneMapping( vec3 color ) { return ACESFilmicToneMapping( color ); }

vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 GammaToLinear( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( gammaFactor ) ), value.a );
}
vec4 LinearToGamma( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( 1.0 / gammaFactor ) ), value.a );
}
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 RGBEToLinear( in vec4 value ) {
	return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}
vec4 LinearToRGBE( in vec4 value ) {
	float maxComponent = max( max( value.r, value.g ), value.b );
	float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
	return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
}
vec4 RGBMToLinear( in vec4 value, in float maxRange ) {
	return vec4( value.rgb * value.a * maxRange, 1.0 );
}
vec4 LinearToRGBM( in vec4 value, in float maxRange ) {
	float maxRGB = max( value.r, max( value.g, value.b ) );
	float M = clamp( maxRGB / maxRange, 0.0, 1.0 );
	M = ceil( M * 255.0 ) / 255.0;
	return vec4( value.rgb / ( M * maxRange ), M );
}
vec4 RGBDToLinear( in vec4 value, in float maxRange ) {
	return vec4( value.rgb * ( ( maxRange / 255.0 ) / value.a ), 1.0 );
}
vec4 LinearToRGBD( in vec4 value, in float maxRange ) {
 	float maxRGB = max( value.r, max( value.g, value.b ) );
 	float D = max( maxRange / maxRGB, 1.0 );
 	D = clamp( floor( D ) / 255.0, 0.0, 1.0 );
 	return vec4( value.rgb * ( D * ( 255.0 / maxRange ) ), D );
 }
 const mat3 cLogLuvM = mat3( 0.2209, 0.3390, 0.4184, 0.1138, 0.6780, 0.7319, 0.0102, 0.1130, 0.2969 );
 vec4 LinearToLogLuv( in vec4 value ) {
 	vec3 Xp_Y_XYZp = cLogLuvM * value.rgb;
 	Xp_Y_XYZp = max( Xp_Y_XYZp, vec3( 1e-6, 1e-6, 1e-6 ) );
 	vec4 vResult;
 	vResult.xy = Xp_Y_XYZp.xy / Xp_Y_XYZp.z;
 	float Le = 2.0 * log2(Xp_Y_XYZp.y) + 127.0;
 	vResult.w = fract( Le );
 	vResult.z = ( Le - ( floor( vResult.w * 255.0 ) ) / 255.0 ) / 255.0;
 	return vResult;
 }
 const mat3 cLogLuvInverseM = mat3( 6.0014, -2.7008, -1.7996, -1.3320, 3.1029, -5.7721, 0.3008, -1.0882, 5.6268 );
 vec4 LogLuvToLinear( in vec4 value ) {
 	float Le = value.z * 255.0 + value.w;
 	vec3 Xp_Y_XYZp;
 	Xp_Y_XYZp.y = exp2( ( Le - 127.0 ) / 2.0 );
 	Xp_Y_XYZp.z = Xp_Y_XYZp.y / value.y;
 	Xp_Y_XYZp.x = value.x * Xp_Y_XYZp.z;
 	vec3 vRGB = cLogLuvInverseM * Xp_Y_XYZp.rgb;
 	return vec4( max( vRGB, 0.0 ), 1.0 );
 }
 vec4 linearToOutputTexel( vec4 value ) { return LinearTosRGB( value ); }
 
 
 	
 		
 		// 💉 injected uniforms: <- injected as a matter of course by three.js. 
 		// uniform mat4 modelMatrix; ✅ 			// = object.matrixWorld
 		// uniform mat4 modelViewMatrix; ✅ 	// = camera.matrixWorldInverse * object.matrixWorld
 		// uniform mat4 projectionMatrix; ✅ 	// = camera.projectionMatrix
 		// uniform mat4 viewMatrix; ✅				// = camera.matrixWorldInverse
 		// uniform mat3 normalMatrix; ✅			// = inverse transpose of modelViewMatrix
 		// uniform vec3 cameraPosition; ✅		// = camera position in world space
 		
 		uniform vec4 uClippingPlanes[3];
 
 		varying vec3 vCameraPosition;
 		varying vec4 vWorldSpaceCoordinates; 
 		varying vec4 vViewSpaceCoordinates; 
 		varying vec4 vClipSpaceCoordinates; 
 	
 	
 		void main() {
 
 
 		
 			vec4 red_color = vec4(0.0, 1.0, 0.0, 1.0); 
 			bool out_of_bounds = false; 
 			
 			// -- TODO: we could implement clipping planes as follows:
 			vec4 plane; // where 𝑛 = [x, y, z] is the normal vector of the plane, and w is the constant offset value from the origin
 			
 						plane = uClippingPlanes[ 0 ];
 						//calculate signed distance to plane of vertex and camera
 						if ( dot( vWorldSpaceCoordinates.xyz , plane.xyz ) > plane.w /*&& dot( vCameraPosition.xyz , plane.xyz ) > plane.w*/  ) {
 							out_of_bounds = true;  	
 						}	
 					
 						plane = uClippingPlanes[ 1 ];
 						//calculate signed distance to plane of vertex and camera
 						if ( dot( vWorldSpaceCoordinates.xyz , plane.xyz ) > plane.w /*&& dot( vCameraPosition.xyz , plane.xyz ) > plane.w*/  ) {
 							out_of_bounds = true;  	
 						}	
 					
 						plane = uClippingPlanes[ 2 ];
 						//calculate signed distance to plane of vertex and camera
 						if ( dot( vWorldSpaceCoordinates.xyz , plane.xyz ) > plane.w /*&& dot( vCameraPosition.xyz , plane.xyz ) > plane.w*/  ) {
 							out_of_bounds = true;  	
 						}	
 					
 
 			// the color is slightly irrelevant
 			if (out_of_bounds == true ) discard; 
 		
 			gl_FragColor = red_color;
 			
 			
 
 		}