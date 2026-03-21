import { HSR } from "../../mesh/hidden-surface-removal";
import { FileMesh } from "../../mesh/mesh";
import { hashVec2, offsetMesh } from "../../mesh/mesh-deform";
import type { CFrame, Instance } from "../../rblx/rbx";
import { arrIsSameWrapLayer, WrapLayerDesc } from "./layersDesc";
import { promiseForMesh } from "./meshDesc";

const modelHSRDescs = new Map<Instance,HSRDesc>()
const CACHE_uvToHits = new Map<string,Map<number,number>>()

export class HSRDesc {
    layers?: WrapLayerDesc[]

    uvsToHits?: Promise<Map<number,number>[] | Response>

    isSame(other: HSRDesc) {
        if ((!this.layers && other.layers) || (this.layers && !other.layers)) {
            return false
        }

        if (this.layers && other.layers) {
            if (!arrIsSameWrapLayer(this.layers, other.layers)) {
                return false
            }
        }

        return true
    }

    fromModel(model: Instance) {
        //underneath wrap layers
        const underneathLayers: WrapLayerDesc[] = []

        for (const otherWrapLayer of model.GetDescendants()) {
            if (otherWrapLayer.className === "WrapLayer") {
                const layerOrder = otherWrapLayer.Prop("Order") as number
                const deformationReference = otherWrapLayer.Prop("ReferenceMeshId") as string
                const referenceOrigin = otherWrapLayer.Prop("ReferenceOrigin") as CFrame
                const deformationCage = otherWrapLayer.Prop("CageMeshId") as string
                const cageOrigin = otherWrapLayer.Prop("CageOrigin") as CFrame

                const underneathLayer = new WrapLayerDesc(deformationReference, referenceOrigin, deformationCage, cageOrigin)
                underneathLayer.order = layerOrder
                if (otherWrapLayer.HasProperty("AutoSkin")) {
                    underneathLayer.autoSkin = otherWrapLayer.Prop("AutoSkin") as number
                }
                if (otherWrapLayer.HasProperty("ImportOrigin")) {
                    underneathLayer.importOrigin = otherWrapLayer.Prop("ImportOrigin") as CFrame
                }
                const parent = otherWrapLayer.parent
                if (parent && parent.className === "MeshPart") {
                    underneathLayer.mesh = parent.Prop("MeshId") as string
                }

                underneathLayers.push(underneathLayer)
            }
        }

        this.layers = underneathLayers.sort((a,b) => {return (a.order || 0) - (b.order || 0)})
    }

    async createUVsToHits() {
        const uvsToHits = []

        //load meshes
        const meshMap = new Map<string,FileMesh>()

        const meshPromises: (Promise<[string, Response | FileMesh]>)[] = []
        
        if (!this.layers) {
            throw new Error("HSRDesc has not had fromModel() called")
        }
        for (const enclosedLayer of this.layers) {
            meshPromises.push(promiseForMesh(enclosedLayer.cage))
            meshPromises.push(promiseForMesh(enclosedLayer.reference))
            if (enclosedLayer.mesh) meshPromises.push(promiseForMesh(enclosedLayer.mesh, true))
        }

        const values = await Promise.all(meshPromises)
        for (const [url, mesh] of values) {
            if (mesh instanceof FileMesh) {
                meshMap.set(url, mesh)
            } else {
                return mesh
            }
        }

        //for each layer
        console.time("HSRDesc.createUVsToHits.layers")
        for (const layer of this.layers) {
            const cacheId = `${layer.mesh}-${layer.reference}-${layer.cage}`

            const cacheEntry = CACHE_uvToHits.get(cacheId)

            const latestUvToHitsMap = cacheEntry ? cacheEntry : new Map<number,number>()

            if (!cacheEntry) {
                const cage = meshMap.get(layer.cage)
                const reference = meshMap.get(layer.reference)
                const mesh = layer.mesh ? meshMap.get(layer.mesh) : undefined

                if (!cage || !reference) {
                    throw new Error("this isnt possible, shut up typescript")
                }

                offsetMesh(reference, layer.referenceOrigin)
                offsetMesh(cage, layer.cageOrigin)

                if (mesh) {
                    const hsr = new HSR(mesh, reference, cage)
                    hsr.cullType = "back"
                    const innerHits = hsr.calculateInnerHits()
                    for (let i = 0; i < reference.coreMesh.faces.length; i++) {
                        const face = reference.coreMesh.faces[i]
                        const auv = hashVec2(...reference.coreMesh.verts[face.a].uv)
                        const buv = hashVec2(...reference.coreMesh.verts[face.b].uv)
                        const cuv = hashVec2(...reference.coreMesh.verts[face.c].uv)

                        const innerHit = innerHits[i] / hsr.rayCount

                        //a
                        const originalInnerHitA = latestUvToHitsMap.get(auv)
                        if (originalInnerHitA === undefined || originalInnerHitA > innerHit) {
                            latestUvToHitsMap.set(auv, innerHit)
                        }

                        //b
                        const originalInnerHitB = latestUvToHitsMap.get(buv)
                        if (originalInnerHitB === undefined || originalInnerHitB > innerHit) {
                            latestUvToHitsMap.set(buv, innerHit)
                        }

                        //c
                        const originalInnerHitC = latestUvToHitsMap.get(cuv)
                        if (originalInnerHitC === undefined || originalInnerHitC > innerHit) {
                            latestUvToHitsMap.set(cuv, innerHit)
                        }
                    }
                }

                CACHE_uvToHits.set(cacheId, latestUvToHitsMap)
            }
            uvsToHits.push(latestUvToHitsMap)
        }
        console.timeEnd("HSRDesc.createUVsToHits.layers")

        return uvsToHits
    }

    async compileUVsToHits() {
        if (!this.layers) {
            throw new Error("HSRDesc has not had fromModel() called")
        }

        if (this.uvsToHits) {
            return this.uvsToHits
        }

        this.uvsToHits = new Promise((resolve) => {
            this.createUVsToHits().then((result) => {
                resolve(result)
            })
        })
        
        return this.uvsToHits
    }
}

export function getModelHSRDesc(model: Instance) {
    const newHSRDesc = new HSRDesc()
    newHSRDesc.fromModel(model)

    const oldLayerDesc = modelHSRDescs.get(model)
    if (oldLayerDesc && newHSRDesc.isSame(oldLayerDesc)) {
        return oldLayerDesc
    } else {
        modelHSRDescs.set(model, newHSRDesc)
        return newHSRDesc
    }
}