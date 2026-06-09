import * as THREE from 'three'

const vertexShader = /*glsl*/`
uniform vec2 uOffset;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec2 mapUv = vec2(uv.x * uSize.x + uOffset.x, uv.y * uSize.y + uOffset.y);
    gl_Position = vec4(mapUv.x * 2.0 - 1.0, mapUv.y * 2.0 - 1.0, 0.0, 1.0);
}
`

const fragmentShader = /*glsl*/`
uniform sampler2D uTexture;
varying vec2 vUv;

vec3 sRGBToLinear(vec3 color) {
    return mix(
        color / 12.92, 
        pow((color + 0.055) / 1.055, vec3(2.4)), 
        step(0.04045, color)
    );
}

void main() {
    //sample the original render texture result
    vec4 texColor = texture2D(uTexture, vUv);

    if (texColor.a > 0.0) {
        texColor.rgb /= texColor.a;
    }

    //convert to linear
    gl_FragColor = vec4(sRGBToLinear(texColor.rgb), texColor.a);
}
`

export const Shader_TextureComposer_Gamma = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: {value: undefined},
        uOffset: {value: new THREE.Vector2(0,0)},
        uSize: {value: new THREE.Vector2(1,1)}
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    depthWrite: false,
    transparent: true,
})