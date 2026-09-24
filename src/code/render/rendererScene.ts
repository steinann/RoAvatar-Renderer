import * as THREE from "three"
import { GLTFExporter, OrbitControls } from 'three/examples/jsm/Addons.js';
import type { AnimatorWrapper } from '../rblx/instance/Animator';
import type { AnimationSetEntry } from '../rblx/constant';
import { EmitterGroupDesc } from './mainDescs/emitterGroupDesc';
import { CFrame, type Connection, type Instance, Event } from '../rblx/rbx';
import type { Vec3, Vec4 } from '../mesh/mesh';
import { EffectComposer } from 'postprocessing';
// @ts-expect-error package has no types
import { N8AOPostPass } from "n8ao";
import type { RenderDesc } from "./renderDesc";
import { FLAGS } from "../misc/flags";
import { disposeMesh, RBXRenderer } from "./renderer";
import { Authentication } from "../api";
import { ObjectDesc } from "./mainDescs/objectDesc";
import { download, rad, saveByteArray } from "../misc/misc";

export type GLTFExportOptions = {
    includeAnimations?: boolean,
    binary?: boolean,
}

/**
 * Created by calling RBXRenderer.addScene()
 * @category Renderer
 */
export class RBXRendererScene {
    //important scene components
    scene: THREE.Scene = new THREE.Scene()
    camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera( 70, 1 / 1, 0.1, 100 )
    controls: OrbitControls | undefined

    shouldAnimate: boolean = true
    destroyed: boolean = false

    //renderer
    n8aoPass: N8AOPostPass | undefined = undefined
    effectComposer: EffectComposer | undefined

    //viewport
    scissor?: [number, number, number, number]
    viewport?: [number, number, number, number]

    //renderables data
    addedInstances: Instance[] = []
    isRenderingMesh: Map<Instance,boolean> = new Map()
    renderDescs: Map<Instance,RenderDesc> = new Map()
    destroyConnections: Map<Instance,Connection> = new Map()
    
    compiledRenderDesc: Event = new Event()
    failedRenderDesc: Event = new Event()

    forceAccurateNeedsRegeneration: boolean = false
    particlesStartFull?: number = undefined
    particlesStartFullFramerate: number = FLAGS.PARTICLES_START_FULL_FRAMERATE

    //scene appearance config
    lookAwayVector: Vec3 = [0.406, 0.306, -0.819]
    lookAwayDistance: number = 6

    shadowEnabled: boolean = true
    shadowResolution: [number, number] = [256, 256]
    _wellLitDirectionalLightIntensity: number = Math.PI / 2

    set wellLitDirectionalLightIntensity(v: number) {
        this._wellLitDirectionalLightIntensity = v
        if (this.directionalLight) {
            this.directionalLight.intensity = this._wellLitDirectionalLightIntensity
        }
    }

    get wellLitDirectionalLightIntensity() {
        return this._wellLitDirectionalLightIntensity
    }

    //scene appearance
    plane?: THREE.Mesh
    shadowPlane?: THREE.Mesh
    ambientLight?: THREE.AmbientLight
    directionalLight?: THREE.DirectionalLight
    directionalLight2?: THREE.DirectionalLight

    /** Forces viewport to be within bounds */
    setRect(bounds: DOMRect) {
        this.viewport = [bounds.left, window.innerHeight - bounds.bottom, bounds.width, bounds.height]
        this.scissor = [...this.viewport]
    }

    /** Makes viewport size 0x0, invisible */
    noRect() {
        this.viewport = [0,0,0,0]
        this.scissor = [0,0,0,0]
    }

    /** Destroys all renderDescs but does not call Destroy on instances */
    destroy() {
        if (this.destroyed) return
        this.destroyed = true

        for (const instance of this.renderDescs.keys()) {
            RBXRenderer.removeInstance(instance, this)
        }

        RBXRenderer.scenes.splice(RBXRenderer.scenes.indexOf(this), 1)

        if (this.plane) {
            disposeMesh(this.scene, this.plane)
            this.plane = undefined
        }
        if (this.shadowPlane) {
            disposeMesh(this.scene, this.shadowPlane)
            this.shadowPlane = undefined
        }
        if (this.effectComposer) {
            this.effectComposer.dispose()
        }
    }

    /**
     * Checks that renderDescs for provided instances are compiled, ignores instances that shouldn't be compiled or haven't been added
     * @returns true if all provided instances's renderDescs have been compiled
     */
    areInstancesCompiled(instances: Instance[]): boolean {
        for (const instance of instances) {
            if (!this.addedInstances.includes(instance)) continue;

            const renderDesc = this.renderDescs.get(instance)
            if (!renderDesc || !renderDesc.compiled || this.isRenderingMesh.get(instance)) {
                return false
            }
        }

        return true
    }

    /**
     * Checks that all renderDescs are compiled
     * @return true if all have been compiled
     */
    isFullyCompiled(): boolean {
        return this.areInstancesCompiled(this.addedInstances)
    }

    /**
     * Exports scene as a GLTF or GLB
     * @param name Name of the resulting file if autoDownload is true
     * @param autoDownload If resulting file should be auto downloaded
     * @returns The GLB (buffer) or GLTF (object)
     */
    async exportGLTF(name: string = "scene", autoDownload: boolean = true, options?: GLTFExportOptions): Promise<ArrayBuffer | {[key: string]: unknown}> {
        const actualOptions: GLTFExportOptions = {
            includeAnimations: false,
            binary: false,
        }
        if (options) Object.assign(actualOptions, options)

        const clips: THREE.AnimationClip[] = []

        let animator: Instance | undefined = undefined
        let allInstances: Instance[] = []

        //get all instances
        let rootInstance: Instance | undefined = undefined
        const allRenderedInstances = Array.from(this.renderDescs.keys())
        let parent = allRenderedInstances[0].parent
        while (parent !== undefined) {
            if (parent.parent === undefined) {
                rootInstance = parent
                allInstances = [parent, ...parent.GetDescendants()]
                break
            }
            parent = parent.parent
        }

        //find animator
        for (const instance of allInstances) {
            if (instance.className === "Animator") {
                animator = instance
                break
            }
        }

        const GLTF_FPS = 30

        //play each track in animator and store clip
        if (animator && actualOptions.includeAnimations && rootInstance) {
            const w = animator.w as AnimatorWrapper

            for (const animationEntryKey of Object.keys(w.data.animationSet)) {

                let trackIndex = 0
                for (const animationEntry of w.data.animationSet[animationEntryKey] as AnimationSetEntry[]) {

                    //run a track
                    const track = w._getTrack(animationEntry.id)
                    if (track) {
                        const objectPositions: Map<Instance, Vec3[]> = new Map()
                        const objectRotations: Map<Instance, Vec3[]> = new Map()

                        const bonePositions: Map<THREE.Bone, Vec3[]> = new Map()
                        const boneQuaternions: Map<THREE.Bone, Vec4[]> = new Map()

                        track.weight = 1;
                        
                        //run all frames of animation and store positions/rotations
                        const times: number[] = []
                        for (let i = 0; i < Math.max(1,Math.ceil(track.length * GLTF_FPS)); i++) {
                            w.restPose()
                            track.setTime(i / GLTF_FPS)
                            if (w.data.currentMoodAnimationTrack) w.data.currentMoodAnimationTrack.setTime(0)
                            times.push(i / GLTF_FPS)

                            rootInstance.preRender()
                            RBXRenderer.addInstance(rootInstance, new Authentication(), this)

                            for (const instance of allRenderedInstances) {
                                if (instance.className === "Attachment") continue

                                //bones
                                let isSkinned = false

                                const renderDesc = this.renderDescs.get(instance)
                                if (renderDesc && renderDesc instanceof ObjectDesc && renderDesc.skeletonDesc) {
                                    isSkinned = true
                                    const bones = renderDesc.skeletonDesc.bones
                                    for (const bone of bones) {
                                        if (!bonePositions.has(bone)) bonePositions.set(bone, [])
                                        if (!boneQuaternions.has(bone)) boneQuaternions.set(bone, [])

                                        bonePositions.get(bone)!.push(bone.position.toArray())
                                        boneQuaternions.get(bone)!.push(bone.quaternion.toArray())
                                    }
                                }

                                //instance itself
                                let partToUse = instance
                                if (partToUse.className === "Decal" && partToUse.parent) {
                                    partToUse = partToUse.parent
                                }

                                let cf = partToUse.PropOrDefault("CFrame", new CFrame()) as CFrame
                                if (isSkinned) {
                                    cf = new CFrame()
                                }
                                
                                if (!objectPositions.has(instance)) objectPositions.set(instance, [])
                                if (!objectRotations.has(instance)) objectRotations.set(instance, [])

                                objectPositions.get(instance)!.push(cf.Position)
                                objectRotations.get(instance)!.push([rad(cf.Orientation[0]),rad(cf.Orientation[1]),rad(cf.Orientation[2])])
                            }
                        }

                        //create keyframe tracks
                        const keyframeTracks: THREE.KeyframeTrack[] = []
                        for (const instance of allRenderedInstances) {
                            if (instance.className === "Attachment") continue

                            const thisPositions = objectPositions.get(instance)
                            const thisRotations = objectRotations.get(instance)
                            if (thisPositions && thisRotations) {
                                const instanceName = instance.PropOrDefault("Name", "Mesh") + "_" + instance.id

                                keyframeTracks.push(new THREE.VectorKeyframeTrack(instanceName + ".position", times, thisPositions.flat()))

                                const quaternionValues: number[] = []
                                for (const rotationValue of thisRotations) {
                                    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotationValue, "YXZ"))
                                    quaternionValues.push(quat.x, quat.y, quat.z, quat.w)
                                }

                                keyframeTracks.push(new THREE.QuaternionKeyframeTrack(instanceName + ".quaternion", times, quaternionValues))
                            }

                            //bones
                            const renderDesc = this.renderDescs.get(instance)
                            if (renderDesc && renderDesc instanceof ObjectDesc && renderDesc.skeletonDesc) {
                                const bones = renderDesc.skeletonDesc.bones
                                for (const bone of bones) {
                                    const thisBonePositions = bonePositions.get(bone)
                                    const thisBoneQuaternions = boneQuaternions.get(bone)

                                    if (thisBonePositions && thisBoneQuaternions) {
                                        keyframeTracks.push(new THREE.VectorKeyframeTrack(bone.name + ".position", times, thisBonePositions.flat()))
                                        keyframeTracks.push(new THREE.QuaternionKeyframeTrack(bone.name + ".quaternion", times, thisBoneQuaternions.flat()))
                                    }
                                }
                            }
                        }

                        //create clip
                        const clip = new THREE.AnimationClip(animationEntryKey + "_" + trackIndex, track.length, keyframeTracks)
                        clips.push(clip)

                        console.log(`Generated clip (${clip.name}) with ${clip.tracks.length} tracks and length of ${track.length}`)
                    }

                    trackIndex += 1
                }
            }

            w.restPose()
            rootInstance.preRender()
            RBXRenderer.addInstance(rootInstance, new Authentication(), this)
        }

        for (const renderedInstance of allRenderedInstances) {
            if (this.renderDescs.get(renderedInstance) instanceof EmitterGroupDesc) {
                RBXRenderer.removeInstance(renderedInstance, this)
            }
        }

        return new Promise((resolve, reject) => {
            const exporter = new GLTFExporter()
            exporter.parse(this.scene, (gltf) => {
                if (autoDownload) {
                    if (gltf instanceof ArrayBuffer) {
                        saveByteArray([gltf], `${name}.glb`)
                    } else {
                        download(`${name}.gltf`,JSON.stringify(gltf))
                    }
                }

                resolve(gltf)
            }, (error) => {
                reject(error)
            }, {
                animations: clips,
                binary: actualOptions.binary,
            })
        })
    }
}