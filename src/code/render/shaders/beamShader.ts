export const beam_vertexShader = /*glsl*/`
varying vec2 vUv;
varying vec4 vColor;

void main() {
    vUv = uv;
    vColor = color;

    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * modelViewPosition;
}
`

export const beam_fragmentShader = /*glsl*/`
//artibutes
varying vec2 vUv;
varying vec4 vColor;

//textures
uniform sampler2D uMap;

//uniforms
uniform float uLightInfluence;
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
    // Sample the texture using the UV coordinates
    vec4 texColor = texture2D(uMap, vUv);

    // Apply lighting
    vec3 light = ambientLightColor;
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            light += directionalLights[i].color * 0.2; //otherwise directional lights affect it WAY too much
        }
    #endif

    float baseAlpha = texColor.a * vColor.a;

    vec4 finalColor;
    finalColor.rgb = texColor.rgb * vColor.rgb;

    //#ADDITIVE_INSERT

    finalColor = vec4(mix(finalColor.rgb * vec3(uBrightness, uBrightness, uBrightness), finalColor.rgb * light, uLightInfluence), finalColor.a);

    /*float brightness = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114)); //kinda additive (but results in correct alpha)

    finalColor.a = mix(baseAlpha, brightness, uLightEmission);*/

    
    finalColor.a = mix(baseAlpha, 0.0, uLightEmission); //true additive (but results in incorrect alpha)

    //encode both blend alpha (as most significant) and true alpha (as least significant), then unpack later on the cpu for thumbnail generation (this doesnt work we also render like everything else kinda forgot)
    /*float blendAlpha = 1.0 - uLightEmission;

    finalColor.a = floor(blendAlpha * 100.0) / 100.0 + baseAlpha / 100.0;*/

    gl_FragColor = finalColor;

    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    gl_FragColor.rgb *= baseAlpha;
}
`