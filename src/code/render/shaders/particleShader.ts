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

export const particle_fragmentShaderOld = /*glsl*/`
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
#if NUM_DIR_LIGHTS > 0
    struct DirectionalLight {
    vec3 direction;
    vec3 color;
    };
    uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS]; 
#endif

uniform vec3 ambientLightColor; 

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;
    float frameTransition = vInstanceSeedTime.z;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor0 = texture2D(uMap, vUv * uFlipbookSize + vFlipbookUv0);
    vec4 texColor1 = texture2D(uMap, vUv * uFlipbookSize + vFlipbookUv1);

    vec4 texColor = mix(texColor0, texColor1, frameTransition);

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
export const particle_fragmentShader_additiveOld = particle_fragmentShaderOld.replace("//#ADDITIVE_INSERT",/*glsl*/`
if (opacityColor.r + opacityColor.g + opacityColor.b <= 0.05) {
    discard;
}`)

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
uniform float uLightEmission;
uniform float uBrightness;

//light uniforms
#if NUM_DIR_LIGHTS > 0
    struct DirectionalLight {
    vec3 direction;
    vec3 color;
    };
    uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS]; 
#endif

uniform vec3 ambientLightColor; 

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;
    float frameTransition = vInstanceSeedTime.z;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor0 = texture2D(uMap, vUv * uFlipbookSize + vFlipbookUv0);
    vec4 texColor1 = texture2D(uMap, vUv * uFlipbookSize + vFlipbookUv1);

    vec4 texColor = mix(texColor0, texColor1, frameTransition);

    //new version of section below
    vec4 alphaTex = texture2D(uAlphaMap, vec2(time, seed)); 
    vec4 colorTex = texture2D(uColorMap, vec2(time, seed));

    /*vec4 alphaTex = texture2D(uAlphaMap, vec2(time, seed)); 
    vec4 colorTex = texture2D(uColorMap, vec2(time, seed));

    // Tint texture with our color
    vec4 tintedColor = texColor * vec4(vInstanceColor, 1.0);

    // Apply opacity to the texture alpha
    vec4 opacityColor = tintedColor * vec4(1.0, 1.0, 1.0, uOpacity * vInstanceOpacity) * alphaTex.r;

    // Apply that weird color things sparkles have
    vec4 finalColor = opacityColor;
    finalColor.rgb = mix(opacityColor.rgb, opacityColor.rgb * colorTex.rgb, colorTex.a);*/

    // Apply lighting
    vec3 light = ambientLightColor;
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            light += directionalLights[i].color;
        }
    #endif

    float baseAlpha = texColor.a * (vInstanceOpacity * uOpacity) * alphaTex.r;

    vec4 finalColor;
    finalColor.rgb = texColor.rgb * colorTex.rgb * vInstanceColor * baseAlpha;

    //#ADDITIVE_INSERT

    finalColor = vec4(mix(finalColor.rgb * vec3(uBrightness, uBrightness, uBrightness), finalColor.rgb * light, uLightInfluence), finalColor.a);

    float brightness = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));

    finalColor.a = mix(baseAlpha, brightness, uLightEmission);

    gl_FragColor = finalColor;
}
`

export const smoke_fragmentShader = /*glsl*/`
//artibutes
varying vec2 vUv;
varying vec3 vInstanceColor;
varying float vInstanceOpacity;
varying vec3 vInstanceSeedTime;

//textures
uniform sampler2D uColorMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uMap;

//uniforms
uniform float uOpacity;

//light uniforms
#if NUM_DIR_LIGHTS > 0
    struct DirectionalLight {
    vec3 direction;
    vec3 color;
    };
    uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS]; 
#endif

uniform vec3 ambientLightColor; 

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor = texture2D(uMap, vUv);

    float alphaValue = texture2D(uAlphaMap, vec2(time, seed)).r * uOpacity * vInstanceOpacity; 
    vec4 colorTex = texture2D(uColorMap, vec2(time, seed)) * vec4(vInstanceColor, 1.0);

    // Apply lighting
    vec3 light = ambientLightColor;
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            light += directionalLights[i].color;
        }
    #endif

    vec4 finalColor;
    finalColor.rgb = texColor.rgb * colorTex.rgb;
    finalColor.a = texColor.a * alphaValue;

    finalColor = vec4(finalColor.rgb * light, finalColor.a);
    finalColor.rgb *= finalColor.a;

    gl_FragColor = finalColor;
}
`

export const sparkles2016_fragmentShader = /*glsl*/`
//artibutes
varying vec2 vUv;
varying vec3 vInstanceColor;
varying vec3 vInstanceSeedTime;

//textures
uniform sampler2D uColorMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uMap;

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor = texture2D(uMap, vUv);

    float alphaValue = texture2D(uAlphaMap, vec2(time, seed)).r; 
    vec4 colorTex = texture2D(uColorMap, vec2(time, seed));
    colorTex.a = alphaValue;

    vec4 finalColor;

    if( texColor.a < 0.5f )
	{
		finalColor.rgb = colorTex.rgb * vInstanceColor * (2.0 * texColor.a);
	}
	else
	{
		finalColor.rgb = mix( colorTex.rgb * vInstanceColor, texColor.rgb, 2.0*texColor.a-1.0 );
	}

    finalColor.rgb *= colorTex.a;
    finalColor.a = texColor.a * colorTex.a * 1.0;

    gl_FragColor = finalColor;
}
`

export const basicParticle_fragmentShader = /*glsl*/`
//artibutes
varying vec2 vUv;
varying vec3 vInstanceColor;
varying vec3 vInstanceSeedTime;

//textures
uniform sampler2D uColorMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uMap;

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor = texture2D(uMap, vUv);

    float alphaValue = texture2D(uAlphaMap, vec2(time, seed)).r; 
    vec4 colorTex = texture2D(uColorMap, vec2(time, seed));
    colorTex.a = alphaValue;

    vec4 finalColor;
    finalColor.rgb = (texColor.rgb + colorTex.rgb) * vInstanceColor;
    finalColor.a = texColor.a * colorTex.a;

    finalColor.rgb *= finalColor.a;

    gl_FragColor = finalColor;
}
`

export const fire_fragmentShader = /*glsl*/`
//artibutes
varying vec2 vUv;
varying vec3 vInstanceColor;
varying vec3 vInstanceSeedTime;

//textures
uniform sampler2D uColorMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uMap;

void main() {
    float seed = vInstanceSeedTime.x;
    float time = vInstanceSeedTime.y;

    // Sample the texture using the UV coordinates (for both frames)
    vec4 texColor = texture2D(uMap, vUv);

    float alphaValue = texture2D(uAlphaMap, vec2(time, seed)).r; 
    vec4 colorTex = vec4(1.0, 0.0, 0.0, 0.0);
    colorTex.a = alphaValue;

    vec4 finalColor;
    finalColor.rgb = texColor.rgb * vInstanceColor;
    finalColor.a = texColor.a * colorTex.a;

    finalColor.rgb *= finalColor.a;

    gl_FragColor = finalColor;
}
`