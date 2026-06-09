export const particle_vertexShader = /*glsl*/`
attribute vec3 instanceColor;
attribute vec3 instanceSeedTime;
attribute float instanceOpacity;
attribute vec4 instanceFlipbook;

varying vec2 vUv;
varying vec3 vInstanceColor;
varying float vInstanceOpacity;
varying vec3 vInstanceSeedTime;
varying vec2 vFlipbookUv0;
varying vec2 vFlipbookUv1;

uniform float uZOffset;

void main() {
    vUv = uv;
    vInstanceColor = instanceColor;
    vInstanceOpacity = instanceOpacity;
    vInstanceSeedTime = instanceSeedTime;
    vFlipbookUv0 = instanceFlipbook.xy;
    vFlipbookUv1 = instanceFlipbook.zw;

    vec4 modelViewPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);

    //offset position toward camera
    vec3 viewDir = normalize(modelViewPosition.xyz);
    modelViewPosition.xyz += viewDir * -uZOffset;

    gl_Position = projectionMatrix * modelViewPosition;
}
`

export const particle_fragmentShader = /*glsl*/`
//artibutes
varying vec2 vUv;
varying vec3 vInstanceColor;
varying float vInstanceOpacity;
varying vec3 vInstanceSeedTime;
varying vec2 vFlipbookUv0;
varying vec2 vFlipbookUv1;

//textures
uniform sampler2D uColorMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uMap;

//uniforms
uniform float uLightInfluence;
uniform float uOpacity;
uniform vec2 uFlipbookSize;

//light uniforms
struct DirectionalLight {
  vec3 direction;
  vec3 color;
};
uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS]; 

uniform vec3 ambientLightColor; 

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;
    float flipbookFrameTime = vInstanceSeedTime.z;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor0 = texture2D(uMap, vUv * uFlipbookSize + vFlipbookUv0);
    vec4 texColor1 = texture2D(uMap, vUv * uFlipbookSize + vFlipbookUv1);

    float frameTransition = mod(time, flipbookFrameTime) / flipbookFrameTime;
    vec4 texColor = texColor0 * (1.0 - frameTransition) + texColor1 * frameTransition;

    vec4 alphaTex = texture2D(uAlphaMap, vec2(time, seed)); 
    vec4 colorTex = texture2D(uColorMap, vec2(time, seed));

    // Tint texture with our color
    vec4 tintedColor = texColor * vec4(vInstanceColor, 1.0);

    // Apply opacity to the texture alpha
    vec4 opacityColor = tintedColor * vec4(1.0, 1.0, 1.0, uOpacity * vInstanceOpacity) * alphaTex.r;

    //#ADDITIVE_INSERT

    // Apply that weird color things sparkles have
    vec4 finalColor = opacityColor;
    finalColor.rgb = mix(opacityColor.rgb, opacityColor.rgb * colorTex.rgb, colorTex.a);

    // Apply lighting
    vec3 light = ambientLightColor;
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            light += directionalLights[i].color;
        }
    #endif

    finalColor = vec4(mix(finalColor.rgb, finalColor.rgb * light, uLightInfluence), finalColor.a);

    gl_FragColor = finalColor;
}
`

//alpha discard for additive particles (pure black = fully transparent)
export const particle_fragmentShader_additive = particle_fragmentShader.replace("//#ADDITIVE_INSERT",/*glsl*/`
if (opacityColor.r + opacityColor.g + opacityColor.b <= 0.05) {
    discard;
}`)