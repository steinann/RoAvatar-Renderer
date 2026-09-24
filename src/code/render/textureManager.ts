import * as THREE from "three"
import { API } from "../api"

interface TextureInfo {
    texture: Promise<THREE.Texture | undefined> | THREE.Texture | undefined,
    uses: number,
    disposeTimeout?: NodeJS.Timeout
}

export interface TextureParams {
    colorSpace: THREE.ColorSpace,
}

export const managedTextures = new Map<string, TextureInfo>()

//promise that loads image then creates three texture
async function createTexturePromise(url: string, params?: TextureParams): Promise<THREE.Texture | undefined> {
    const image = await API.Generic.LoadImage(url)
    if (!image) return undefined

    const texture = new THREE.Texture(image,  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, params?.colorSpace || "srgb")
    texture.needsUpdate = true
    return texture
}

//creates textureInfo and texture promise
function createManagedTexture(url: string, params?: TextureParams): TextureInfo {
    const textureInfo: TextureInfo = {
        texture: undefined,
        uses: 1, //used by texture promise (internal), so we dont try to dispose when it doesnt even exist yet
    }

    textureInfo.texture = new Promise((resolve) => {
        createTexturePromise(url, params).then((result) => {
            textureInfo.texture = result
            finishManagedTexture(url, params) //removes use by texture promise (internal)
            resolve(result)
        })
    })

    return textureInfo
}

function getTextureInfoKey(url: string, params?: TextureParams) {
    return url + JSON.stringify(params)
}

export async function getManagedTexture(url: string, params?: TextureParams): Promise<THREE.Texture | undefined> {
    const key = getTextureInfoKey(url, params)

    //get texture info
    let managedTextureInfo = managedTextures.get(key)
    if (!managedTextureInfo) {
        managedTextureInfo = createManagedTexture(url, params)
        managedTextures.set(key, managedTextureInfo)
    }

    //add use (external)
    managedTextureInfo.uses += 1
    
    //cancel dispose timeout
    const disposeTimeout = managedTextureInfo.disposeTimeout
    if (disposeTimeout) {
        clearTimeout(disposeTimeout)
        managedTextureInfo.disposeTimeout = undefined
    }

    return managedTextureInfo.texture
}

export async function finishManagedTexture(url: string, params?: TextureParams) {
    const key = getTextureInfoKey(url, params)

    //get managed texture info and remove use
    const managedTextureInfo = managedTextures.get(key)
    if (managedTextureInfo) {
        managedTextureInfo.uses -= 1

        //create timeout for disposal if no uses left and no timeout exists already
        if (managedTextureInfo.uses <= 0) {
            if (!managedTextureInfo.disposeTimeout) {
                const disposeTimeout = setTimeout(() => {
                    //cancel timeout if disposeTimeout is invalid
                    if (managedTextureInfo.disposeTimeout !== disposeTimeout || managedTextureInfo.uses > 0) return

                    managedTextures.delete(key)
                    
                    const texture = managedTextureInfo.texture
                    if (texture && texture instanceof THREE.Texture) { //its okay that we dont check for Promise<Texture> since the promises adds one use to the texture
                        texture.dispose()
                    }
                }, 5000) //5 seconds
                managedTextureInfo.disposeTimeout = disposeTimeout
            }
        }
    }
}