import * as THREE from 'three';
import type { MeshDesc } from "./meshDesc";
import { CFrame, Instance, Vector3 } from '../../rblx/rbx';
import type { ObjectDesc } from '../mainDescs/objectDesc';
import { FLAGS } from '../../misc/flags';
import { log } from '../../misc/logger';
import { setTHREEObjectCF } from '../renderDesc';
import { BasePartWrapper } from '../../rblx/instance/BasePart';
import { Assembly, AssemblyNode } from '../../rblx/assembly';
import { multiply } from '../../mesh/mesh-deform';
import { AbbreviationToFaceControlProperty } from '../../rblx/constant';
import { deg, rad } from '../../misc/misc';
import { FaceControlsWrapper } from '../../rblx/instance/FaceControls';

function diffCFrame(parent: CFrame, child: CFrame) {
    return parent.inverse().multiply(child)
}

function boneIsChildOf(bone: THREE.Bone, parentName: string) {
    let nextParent = bone.parent
    while (nextParent) {
        if (nextParent.name === parentName) {
            return true
        }
        nextParent = nextParent.parent
    }
    return false
}

/**
 * Child of a MeshDesc
 * Used to describe skeletons
 */
export class SkeletonDesc {
    renderableDesc: ObjectDesc
    meshDesc: MeshDesc

    skeleton: THREE.Skeleton
    rootBone: THREE.Bone
    bones: THREE.Bone[]
    originalBoneCFrames: CFrame[] = []
    boneSourceParts: (string | undefined)[] = []
    skeletonHelper?: THREE.SkeletonHelper

    frameCount: number = 0

    constructor(renderableDesc: ObjectDesc, meshDesc: MeshDesc, scene: THREE.Scene) {
        this.renderableDesc = renderableDesc
        this.meshDesc = meshDesc

        const mesh = this.meshDesc.fileMesh
        if (!mesh) {
            throw new Error("MeshDesc is not compiled")
        }
        const skinning = mesh.skinning
        
        //create bones
        const boneArr: THREE.Bone[] = []
        for (let i = 0; i < skinning.bones.length; i++) {
            const threeBone = new THREE.Bone()
            threeBone.name = skinning.bones[i].name || ""
            if (threeBone.name === "HumanoidRootNode") {
                threeBone.name = "HumanoidRootPart"
            }
            if (threeBone.name === "root") {
                threeBone.name = "Root"
            }
            boneArr.push(threeBone)
        }

        this.bones = boneArr

        log(false, skinning)
        log(false, this)

        //hierarchy
        let rootBone: THREE.Bone | undefined = undefined
        for (let i = 0; i < skinning.bones.length; i++) {
            const bone = skinning.bones[i]
            const threeBone = boneArr[i]

            if (bone.parentIndex < skinning.bones.length) {
                const parentBone = skinning.bones[bone.parentIndex]
                const parentThreeBone = boneArr[bone.parentIndex]

                const worldParentBoneCF = new CFrame(...parentBone.position)
                worldParentBoneCF.fromRotationMatrix(...parentBone.rotationMatrix)

                const worldBoneCF = new CFrame(...bone.position)
                worldBoneCF.fromRotationMatrix(...bone.rotationMatrix)

                const boneCF = worldParentBoneCF.inverse().multiply(worldBoneCF)
                this.boneSourceParts.push(bone.sourcePart)
                this.originalBoneCFrames.push(worldBoneCF)
                setTHREEObjectCF(threeBone, boneCF)

                parentThreeBone.add(threeBone)
            } else {
                rootBone = threeBone

                const boneCF = new CFrame(...bone.position)
                boneCF.fromRotationMatrix(...bone.rotationMatrix)
                this.boneSourceParts.push(bone.sourcePart)
                this.originalBoneCFrames.push(boneCF)
                setTHREEObjectCF(threeBone, boneCF)
            }
        }

        if (!rootBone) {
            throw new Error("FileMesh has no root bone")
        } else {
            log(false, rootBone)
            if (rootBone && rootBone.name !== "Root") {
                const trueRootBone = new THREE.Bone()
                trueRootBone.name = "Root"
                trueRootBone.position.set(0,0,0)
                trueRootBone.rotation.set(0,0,0, "YXZ")
                this.boneSourceParts.unshift(undefined)
                this.originalBoneCFrames.unshift(new CFrame())
                this.bones.unshift(trueRootBone)

                trueRootBone.add(rootBone)
                rootBone = trueRootBone
            }

            this.rootBone = rootBone
        }

        //create skeleton
        this.skeleton = new THREE.Skeleton(boneArr)

        this.setAsRest()

        if (FLAGS.SHOW_SKELETON_HELPER && (FLAGS.SKELETON_HELPER_INSTANCE_NAME === undefined || FLAGS.SKELETON_HELPER_INSTANCE_NAME === meshDesc.instance?.name)) {
            const skeletonHelper = new THREE.SkeletonHelper(this.rootBone)
            scene.add(skeletonHelper)
            this.skeletonHelper = skeletonHelper
        }

        log(false, this.skeleton)

        //scene.add(this.rootBone)
    }

    setAsRest() {
        //update rest position
        for (const bone of this.skeleton.bones) {
            const boneIndex = this.skeleton.bones.indexOf(bone);
            this.skeleton.boneInverses[ boneIndex ].copy(bone.matrixWorld).invert();
        }
    }

    getBoneWithName(name: string) {
        for (const bone of this.bones) {
            if (bone.name === name) {
                return bone
            }
        }
    }

    getRig() {
        const selfInstance = this.meshDesc.instance

        if (!selfInstance) return

        let rig = selfInstance.parent
        if (rig && rig.className !== "Model") {
            rig = rig.parent
        }

        if (rig?.className === "Model") {
            return rig
        }
    }

    getScale(node: AssemblyNode): Vector3 {
        if (this.meshDesc.wasAutoSkinned) return new Vector3(1,1,1)

        const partSize = node.part.Prop("Size") as Vector3
        const meshSize = node.part.PropOrDefault("InitialSize", new Vector3(...this.meshDesc.fileMesh!.size)) as Vector3

        const scale = partSize.divide(meshSize)
        return scale
    }

    getOriginalWorldCFrameNoChange(bone: THREE.Bone) {
        const ogCF = this.originalBoneCFrames[this.bones.indexOf(bone)].clone()

        return ogCF
    }

    getOriginalWorldCFrame(bone: THREE.Bone, node: AssemblyNode) {
        if (this.meshDesc.wasAutoSkinned) {
            const ogCF = this.originalBoneCFrames[this.bones.indexOf(bone)].clone()
            const nodeWorldCF = node.assembly.traverseCFrame(node, false, false)

            return nodeWorldCF.inverse().multiply(ogCF)
        } else {
            const scale = this.getScale(node)

            const ogCF = this.originalBoneCFrames[this.bones.indexOf(bone)].clone()
            ogCF.Position = multiply(ogCF.Position, scale.toVec3())

            return ogCF
        }
    }

    getSourcePart(bone: THREE.Bone): string | undefined {
        return this.boneSourceParts[this.bones.indexOf(bone)]
    }

    getSourceNode(selfNode: AssemblyNode, bone: THREE.Bone, assembly: Assembly) {
        const sourceName = this.getSourcePart(bone)
        const potentialSourceNode = sourceName ? assembly.getNode(sourceName) : selfNode
        const sourceNode = potentialSourceNode ? potentialSourceNode : selfNode

        return sourceNode
    }

    getBoneWorldCFrame(bone: THREE.Bone, assembly: Assembly, selfInstance: Instance, includeTransform: boolean): CFrame {
        const node = assembly.getNode(bone.name)
        
        const selfNode = (selfInstance.w as BasePartWrapper).GetAssemblyNode()
        const sourceNode = this.getSourceNode(selfNode, bone, assembly)

        if (bone.name === "Root") {
            return assembly.traverseCFrame(selfNode, includeTransform, true)
        } else if (node) {
            //this is so the head bone is in the right place so the FACS ends up in the correct place...
            if (this.meshDesc.wasDeformed && !this.meshDesc.wasAutoSkinned && bone.name === "Head") {
                const ogCF = assembly.traverseCFrame(node, includeTransform, true)
                const connectorOffset = node.getConnectorOffset(includeTransform).inverse()
                connectorOffset.Orientation = [0,0,0] //done to keep rotation transform
                return ogCF.multiply(connectorOffset)
            } else {
                return assembly.traverseCFrame(node, includeTransform, true)
            }
        } else {
            const result = assembly.traverseCFrame(sourceNode, includeTransform, true).multiply(this.getOriginalWorldCFrame(bone, sourceNode))
            return result
        }
    }

    isFACS(boneName: string) {
        return this.meshDesc.fileMesh?.facs?.faceBoneNames.includes(boneName)
    }
    
    addFACS(restCF: CFrame, bone: THREE.Bone, assembly: Assembly) {
        const isFACS = this.isFACS(bone.name)
        if (!isFACS) return restCF

        const facsMesh = this.meshDesc.fileMesh
        const facs = this.meshDesc.fileMesh?.facs

        const headNode = assembly.getNode("Head")

        if (headNode && facsMesh && facs && facs.quantizedTransforms) {
            const head = headNode.part

            //create or get face controls
            let faceControls = head.FindFirstChildOfClass("FaceControls")
            if (!faceControls) {
                faceControls = new Instance("FaceControls")
                faceControls.setParent(head)
            }
            new FaceControlsWrapper(faceControls)

            for (let j = 0; j < facs.faceBoneNames.length; j++) {
                const boneName = facs.faceBoneNames[j]

                if (boneName === bone.name) {
                    let totalPosition = new Vector3()
                    let totalRotation = new Vector3()

                    for (let i = 0; i < facs.faceControlNames.length; i++) {
                        const faceControlName = facs.faceControlNames[i]

                        const col = i
                        const row = j
                        //const rows = facs.faceBoneNames.length
                        const cols = facs.faceControlNames.length

                        const index = row * cols + col

                        //const index = i * facs.faceBoneNames.length + j

                        const posX = facs.quantizedTransforms.px.matrix[index]
                        const posY = facs.quantizedTransforms.py.matrix[index]
                        const posZ = facs.quantizedTransforms.pz.matrix[index]

                        const rotX = facs.quantizedTransforms.rx.matrix[index]
                        const rotY = facs.quantizedTransforms.ry.matrix[index]
                        const rotZ = facs.quantizedTransforms.rz.matrix[index]

                        const pos = new Vector3(posX, posY, posZ)
                        const rot = new Vector3(rotX, rotY, rotZ)

                        let weight = 0

                        if (faceControlName.includes(" ")) { //if it is a corrective pose
                            weight = 1
                            for (const faceControlSubname of faceControlName.split(" ")) {
                                const propertyName = AbbreviationToFaceControlProperty[faceControlSubname]
                                weight *= faceControls.Prop(propertyName) as number
                            }
                        } else {
                            const propertyName = AbbreviationToFaceControlProperty[faceControlName]
                            if (propertyName === undefined) {
                                log(false, faceControlName)
                            }
                            weight = faceControls.Prop(propertyName) as number
                        }

                        totalPosition = totalPosition.add(pos.multiply(new Vector3(weight,weight,weight)))
                        totalRotation = totalRotation.add(rot.multiply(new Vector3(weight,weight,weight)))
                    }

                    const resultCF = new CFrame()

                    const euler = new THREE.Euler(rad(totalRotation.X), rad(totalRotation.Y), rad(totalRotation.Z), "XYZ")
                    euler.reorder("YXZ")

                    resultCF.Orientation = [deg(euler.x), deg(euler.y), deg(euler.z)]
                    resultCF.Position = multiply(totalPosition.toVec3(), this.getScale(headNode).toVec3())

                    return restCF.multiply(resultCF)
                }
            }
        }

        return restCF
    }

    updateBoneMatrix(selfInstance: Instance, includeTransform: boolean = false) {
        if (!selfInstance.parent) return
        if (!this.meshDesc.fileMesh) return
        
        const w = selfInstance.w
        if (!(w instanceof BasePartWrapper)) return

        const assembly = w.GetAssembly()
        
        //precompute bone world cframes
        const boneWorldCFrameArr = new Array(this.bones.length)
        for (let i = 0; i < this.bones.length; i++) {
            const bone = this.bones[i]
            const boneWorldCFrame = this.getBoneWorldCFrame(bone, assembly, selfInstance, includeTransform)
            boneWorldCFrameArr[i] = boneWorldCFrame
        }

        //set bones to relative cframes
        for (let i = 0; i < this.bones.length; i++) {
            const bone = this.bones[i]
            const boneWorldCFrame = boneWorldCFrameArr[i]
            let parentBone = bone.parent
            if (!(parentBone instanceof THREE.Bone)) parentBone = null
            
            if (bone && parentBone) {
                //this only applies to non-autoskin FACS accessories and i hate it (only breaks in specific scenarios like magma fiend head)
                if ((boneIsChildOf(bone, "DynamicHead") || bone.name === "DynamicHead") && this.meshDesc.wasDeformed && !this.meshDesc.wasAutoSkinned) {
                    const parentBoneWorldCFrame = this.getOriginalWorldCFrameNoChange(parentBone)
                    const boneWorldCFrameNoChange = this.getOriginalWorldCFrameNoChange(bone)
                    let diffCF = diffCFrame(parentBoneWorldCFrame, boneWorldCFrameNoChange)
                    let scale = new Vector3(1,1,1)
                    const headNode = assembly.getNode("Head")
                    if (headNode) {
                        scale = this.getScale(headNode)
                    }
                    diffCF.Position = multiply(diffCF.Position, scale.toVec3())

                    if (includeTransform) diffCF = this.addFACS(diffCF, bone, assembly)
                    setTHREEObjectCF(bone, diffCF)
                //everything thats normal
                } else {
                    const parentBoneWorldCFrame = boneWorldCFrameArr[this.bones.indexOf(parentBone)]
                    let diffCF = diffCFrame(parentBoneWorldCFrame, boneWorldCFrame)

                    if (includeTransform) diffCF = this.addFACS(diffCF, bone, assembly)
                    setTHREEObjectCF(bone, diffCF)
                }
            } else {
                setTHREEObjectCF(bone, boneWorldCFrame)
            }
        }

        this.updateMatrixWorld()
        if (!includeTransform) {
            this.setAsRest()
            this.updateMatrixWorld()
        }
    }

    updateMatrixWorld() {
        for (const bone of this.skeleton.bones) {
            bone.updateMatrixWorld(true)
        }
    }

    update(instance: Instance) {
        if (!FLAGS.UPDATE_SKELETON || !instance.parent || !this.meshDesc.fileMesh) return

        this.updateBoneMatrix(instance)
        
        if (FLAGS.ANIMATE_SKELETON) {
            //non-facs animation is done in here
            this.updateBoneMatrix(instance, true)
        }

        this.updateMatrixWorld()

        this.frameCount += 1
    }

    dispose(scene: THREE.Scene) {
        if (this.skeletonHelper) {
            scene.remove(this.skeletonHelper)
            this.skeletonHelper.dispose()
            this.skeletonHelper = undefined
        }

        if (this.rootBone.parent) {
            this.rootBone.parent.remove(this.rootBone)
        }

        for (let i = 0; i < this.skeleton.bones.length; i++) {
            const bone = this.skeleton.bones[i];
            if (bone.parent) {
                bone.removeFromParent();
            }
        }
    }

    static descNeedsSkeleton(meshDesc: MeshDesc) {
        return meshDesc.canHaveSkinning && meshDesc.fileMesh && meshDesc.fileMesh.skinning && meshDesc.fileMesh.skinning.numskinnings > 0
    }
}