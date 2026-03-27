import * as THREE from 'three';
import type { MeshDesc } from "./meshDesc";
import { CFrame, Instance, Vector3 } from '../../rblx/rbx';
import { deg, rad } from '../../misc/misc';
import { GetAttachedPart, getOriginalSize, traverseRigCFrame } from '../../rblx/scale';
import { divide, multiply } from '../../mesh/mesh-deform';
import { FaceControlsWrapper } from '../../rblx/instance/FaceControls';
import { AbbreviationToFaceControlProperty } from '../../rblx/constant';
import type { ObjectDesc } from '../objectDesc';
import { FLAGS } from '../../misc/flags';

function setBoneToCFrame(bone: THREE.Bone, cf: CFrame) {
    bone.position.set(...cf.Position)
    bone.rotation.order = "YXZ"
    bone.rotation.x = rad(cf.Orientation[0])
    bone.rotation.y = rad(cf.Orientation[1])
    bone.rotation.z = rad(cf.Orientation[2])
    //bone.rotation.set(rad(cf.Orientation[0]), rad(cf.Orientation[1]), rad(cf.Orientation[2]), "YXZ")
}

//IMPORTANT: this gets the CENTER of the target part, instead of the joint connection it and the parent
/*function getOffsetForInstance(child: Instance, includeTransform: boolean) {
    if (child && (child.className === "MeshPart" || child.className === "Part")) {
        const motor = child.FindFirstChildOfClass("Motor6D")
        if (motor) {
            return calculateMotor6Doffset(motor, includeTransform)
        } else {
            //return new CFrame()
            return child.Prop("CFrame") as CFrame
        }
    }

    return child.Prop("CFrame") as CFrame
}*/

function getJointForInstances(parent: Instance, child: Instance, includeTransform: boolean) {
    const childMotor = child.FindFirstChildOfClass("Motor6D")
    const parentMotor = parent.FindFirstChildOfClass("Motor6D")

    let transform = new CFrame()

    if (childMotor) {
        if (includeTransform) {
            transform = childMotor.Prop("Transform") as CFrame
        }

        let initalCF = new CFrame()
        if (parentMotor) {
            initalCF = (parentMotor.Prop("C1") as CFrame).inverse()
        }
        const jointCF = initalCF.multiply(childMotor.Prop("C0") as CFrame).multiply(transform.inverse())
        
        return jointCF
    }
    return new CFrame()
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

function getMotorsInRig(rigChildren: Instance[]) {
    const motors = []

    for (const child of rigChildren) {
        for (const motor of child.GetChildren()) {
            if (motor.className === "Motor6D") {
                motors.push(motor)
            }
        }
    }

    return motors
}

function getBoneDependencies(rig: Instance) {
    const names: Map<string,string> = new Map()

    //prepare search
    const hrp = rig.FindFirstChild("HumanoidRootPart")
    let currentSearch = hrp ? [hrp] : []
    let currentSearchOrigin = hrp ? ["Root"] : []
    const children = rig.GetChildren()
    const motors = getMotorsInRig(children)

    //do search
    while (currentSearch.length > 0 && currentSearch[0]) {
        const newCurrentSearch: Instance[] = []
        const newCurrentSearchOrigin: string[] = []

        //for each searched
        for (let i = 0; i < currentSearch.length; i++) {
            const toSearch = currentSearch[i]

            //add own name
            const selfName = toSearch === hrp ? "HumanoidRootNode" : toSearch.Prop("Name") as string
            names.set(selfName, currentSearchOrigin[i])

            //find child motors
            for (const motor of motors) {
                if (motor.Prop("Part0") === toSearch) {
                    newCurrentSearch.push(motor.parent!)
                    newCurrentSearchOrigin.push(selfName)
                }
            }
        }

        currentSearch = newCurrentSearch
        currentSearchOrigin = newCurrentSearchOrigin
    }

    //add hardcoded
    if (names.get("Head")) {
        names.set("DynamicHead", "Head")
    }

    return names
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
    originalHeadCFrame: CFrame = new CFrame()
    originalDynamicHeadCFrame: CFrame = new CFrame()
    skeletonHelper?: THREE.SkeletonHelper

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
            threeBone.name = skinning.nameTable[i]
            if (threeBone.name === "HumanoidRootPart") {
                threeBone.name = "HumanoidRootNode"
            }
            if (threeBone.name === "root") {
                threeBone.name = "Root"
            }
            boneArr.push(threeBone)
        }

        this.bones = boneArr

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
                //worldParentBoneCF.Orientation = worldParentBoneCF.inverse().Orientation
                //let euler0 = new THREE.Euler(rad(worldParentBoneCF.Orientation[0]), rad(worldParentBoneCF.Orientation[1]), rad(worldParentBoneCF.Orientation[2]))
                //euler0 = euler0.reorder("YXZ")
                //worldParentBoneCF.Orientation = [deg(euler0.x), deg(euler0.y), deg(euler0.z)]

                const worldBoneCF = new CFrame(...bone.position)
                worldBoneCF.fromRotationMatrix(...bone.rotationMatrix)
                //worldBoneCF.Orientation = worldBoneCF.inverse().Orientation
                //let euler1 = new THREE.Euler(rad(worldBoneCF.Orientation[0]), rad(worldBoneCF.Orientation[1]), rad(worldBoneCF.Orientation[2]))
                //euler1 = euler1.reorder("YXZ")
                //worldBoneCF.Orientation = [deg(euler1.x), deg(euler1.y), deg(euler1.z)]

                const boneCF = worldParentBoneCF.inverse().multiply(worldBoneCF)
                this.originalBoneCFrames.push(boneCF)
                if (threeBone.name === "Head") {
                    this.originalHeadCFrame = boneCF
                } else if (threeBone.name === "DynamicHead") {
                    this.originalDynamicHeadCFrame = boneCF
                }
                setBoneToCFrame(threeBone, boneCF)

                //console.log(threeBone.name, boneCF.Position, boneCF.Orientation)

                parentThreeBone.add(threeBone)
            } else {
                rootBone = threeBone

                const boneCF = new CFrame(...bone.position)
                boneCF.fromRotationMatrix(...bone.rotationMatrix)
                this.originalBoneCFrames.push(boneCF)
                setBoneToCFrame(threeBone, boneCF)

                //console.log(threeBone.name, boneCF.Position, boneCF.Orientation)
            }
        }

        if (!rootBone) {
            throw new Error("FileMesh has no root bone")
        } else {
            if (rootBone && rootBone.name !== "Root") {
                const trueRootBone = new THREE.Bone()
                trueRootBone.name = "Root"
                trueRootBone.position.set(0,0,0)
                trueRootBone.rotation.set(0,0,0, "YXZ")
                this.originalBoneCFrames.unshift(new CFrame())
                this.bones.unshift(trueRootBone)

                trueRootBone.add(rootBone)
                rootBone = trueRootBone
            }

            this.rootBone = rootBone
        }

        //add missing bones
        const rig = this.getRig()
        if (rig) {
            const boneDependencies = getBoneDependencies(rig)
            //console.log(boneDependencies)

            for (const bone of [...this.bones]) {
                //check that bone has all dependencies
                let lastBone: string | undefined = bone.name
                while (lastBone) {
                    const newLastBone = boneDependencies.get(lastBone)
                    if (newLastBone && !this.getBoneWithName(newLastBone)) { //bone missing!
                        this.insertBefore(newLastBone, lastBone)
                    }
                    lastBone = newLastBone
                }
            }
        }

        //create skeleton
        this.skeleton = new THREE.Skeleton(boneArr)

        this.setAsRest()

        if (FLAGS.SHOW_SKELETON_HELPER) {
            const skeletonHelper = new THREE.SkeletonHelper(this.rootBone)
            scene.add(skeletonHelper)
            this.skeletonHelper = skeletonHelper
        }

        //console.log(this.skeleton)

        //scene.add(this.rootBone)
    }

    setAsRest() {
        //update rest position
        for (const bone of this.skeleton.bones) {
            const boneIndex = this.skeleton.bones.indexOf(bone);
            this.skeleton.boneInverses[ boneIndex ].copy(bone.matrixWorld).invert();
        }
    }

    traverseOriginal(name: string) {
        const cframes: CFrame[] = []

        let lastBone = this.getBoneWithName(name)
        while (lastBone) {
            const index = this.bones.indexOf(lastBone)
            const ogCFrame = this.originalBoneCFrames[index]
            cframes.push(ogCFrame)

            lastBone = lastBone.parent ? this.getBoneWithName(lastBone.parent.name) : undefined
        }

        cframes.reverse()
    
        let finalCF = new CFrame()
        for (const cf of cframes) {
            finalCF = finalCF.multiply(cf)
        }
    
        return finalCF
    }

    insertBefore(toInsert: string, before: string) {
        const bone = new THREE.Bone()
        bone.name = toInsert
        bone.position.set(0,0,0)
        bone.rotation.set(0,0,0, "YXZ")

        for (let i = 0; i < this.bones.length; i++) {
            if (this.bones[i].name === before) {
                const beforeBone = this.bones[i]
                const beforeParent = beforeBone.parent

                //this.originalBoneCFrames.splice(i, 0, new CFrame())
                //this.bones.splice(i, 0, bone)
                this.originalBoneCFrames.push(new CFrame())
                this.bones.push(bone)

                bone.add(beforeBone)
                beforeParent?.add(bone)
                break
            }
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

    getPartEquivalent(selfInstance: Instance, name: string) {
        if (!selfInstance.parent) return

        let partEquivalent = selfInstance.parent.FindFirstChild(name)
        if (partEquivalent === undefined && selfInstance.parent.parent) {
            partEquivalent = selfInstance.parent.parent.FindFirstChild(name)
        }

        return partEquivalent
    }

    getRootCFrame(instance: Instance, includeTransform: boolean) {
        if (includeTransform) {
            return instance.Prop("CFrame") as CFrame
        } else {
            let bodyPart: Instance | undefined = undefined
            if (instance.parent && instance.parent.FindFirstChildOfClass("Humanoid")) {
                bodyPart = instance
            } else if (instance.parent && instance.parent.parent && instance.parent.className === "Accessory") {
                bodyPart = GetAttachedPart(instance.parent, instance.parent.parent)
            }

            const hrp = this.getPartEquivalent(instance, "HumanoidRootPart")
            if (hrp && bodyPart) {
                return (hrp.Prop("CFrame") as CFrame).multiply(traverseRigCFrame(bodyPart))
            }
        }

        return new CFrame()
    }

    updateBoneMatrix(selfInstance: Instance, includeTransform: boolean = false) {
        if (!selfInstance.parent) return
        if (!this.meshDesc.fileMesh) return

        const isHead = this.meshDesc.headMesh === this.meshDesc.mesh

        const rootBoneCFog = this.getRootCFrame(selfInstance, includeTransform)
        const humanoidRootPartEquivalent = this.getPartEquivalent(selfInstance, "HumanoidRootPart")

        for (let i = 0; i < this.bones.length; i++) {
            const bone = this.bones[i]

            const partEquivalent = this.getPartEquivalent(selfInstance, bone.name)
            const parentPartEquivalent = bone.parent ? (bone.parent.name !== "HumanoidRootNode" ? this.getPartEquivalent(selfInstance, bone.parent.name) : humanoidRootPartEquivalent) : undefined

            let rootBoneCF = new CFrame()
            if (bone.name === "Root") {
                rootBoneCF = rootBoneCFog
            } else if (bone.parent?.name === "Root") {
                rootBoneCF = rootBoneCFog.inverse()
            }

            if (partEquivalent && parentPartEquivalent) {
                setBoneToCFrame(bone, rootBoneCF.multiply(getJointForInstances(parentPartEquivalent, partEquivalent, includeTransform)))
            } else if (partEquivalent) {
                if (includeTransform) {
                    setBoneToCFrame(bone, rootBoneCF.multiply(partEquivalent.Prop("CFrame") as CFrame))
                } else {
                    let hrpCF = new CFrame()
                    const hrp = humanoidRootPartEquivalent
                    if (hrp) {
                        hrpCF = hrp.Prop("CFrame") as CFrame
                    }
                    setBoneToCFrame(bone, rootBoneCF.multiply(hrpCF.multiply(traverseRigCFrame(partEquivalent))))
                }
            } else if (bone.name === "Root") {
                setBoneToCFrame(bone, rootBoneCF.multiply(new CFrame()))
            } else if (bone.name === "HumanoidRootNode") {
                let rootCF = new CFrame()
                const rootPart = humanoidRootPartEquivalent
                if (rootPart) {
                    rootCF = rootPart.Prop("CFrame") as CFrame
                }

                setBoneToCFrame(bone, rootBoneCF.multiply(rootCF))
            } else if (bone.name === "DynamicHead" && isHead) {
                const head = this.getPartEquivalent(selfInstance, "Head")
                if (head) {
                    let targetCF = this.traverseOriginal("DynamicHead")

                    if (this.meshDesc.wasAutoSkinned) {
                        targetCF = this.originalBoneCFrames[i]
                    }

                    const headSize = head.Prop("Size") as Vector3
                    const ogHeadSize = isHead ? new Vector3(...this.meshDesc.fileMesh.size) : getOriginalSize(head)

                    let scale = divide(headSize.toVec3(), ogHeadSize.toVec3())
                    if (this.meshDesc.wasAutoSkinned) {
                        scale = [1,1,1]
                    }

                    //apply scale
                    const scaledCF = targetCF.clone()
                    scaledCF.Position = multiply(scaledCF.Position, scale)

                    //move to center of head
                    const neck = head.FindFirstChildOfClass("Motor6D")
                    let neckCF = new CFrame()
                    if (neck) {
                        neckCF = neck.PropOrDefault("C1", new CFrame()) as CFrame
                    }

                    //move from center of head to position
                    /*let offset = (head.Prop("CFrame") as CFrame).inverse().multiply(selfInstance.Prop("CFrame") as CFrame)
                    const weld = selfInstance.FindFirstChildOfClass("Weld")
                    if (weld) {
                        offset = weld.PropOrDefault("C1", new CFrame()) as CFrame
                    } else {
                        offset = new CFrame()
                    }*/
                    /*if (!isHead) {
                        console.log("---")
                        console.log((head.Prop("CFrame") as CFrame).Position)
                        console.log((selfInstance.Prop("CFrame") as CFrame).Position)
                    }*/

                    //prevent anything from happening when autoskin
                    if (this.meshDesc.wasAutoSkinned) {
                        neckCF = new CFrame()
                        //offset = new CFrame()
                    }

                    //get total
                    const totalCF = neckCF.inverse().multiply(scaledCF)

                    setBoneToCFrame(bone, totalCF)
                }
            } else if (!isHead || boneIsChildOf(bone, "DynamicHead")) {
                //find scale difference
                const ogCF = this.originalBoneCFrames[i]

                const head = this.getPartEquivalent(selfInstance, "Head")
                if (head) {
                    const headSize = head.Prop("Size") as Vector3
                    const ogHeadSize = isHead ? new Vector3(...this.meshDesc.fileMesh.size) : getOriginalSize(head)

                    let scale = divide(headSize.toVec3(), ogHeadSize.toVec3())
                    if (this.meshDesc.wasAutoSkinned) {
                        scale = [1,1,1]
                    }

                    //apply scale
                    const scaledCF = ogCF.clone()
                    scaledCF.Position = multiply(scaledCF.Position, scale)

                    const headOffset = this.originalHeadCFrame.clone()
                    headOffset.Position = [0,0,0]
                    if (bone.name !== "DynamicHead") {
                        headOffset.Orientation = [0,0,0]
                    }

                    const finalCF = headOffset.multiply(scaledCF)

                    setBoneToCFrame(bone, finalCF)
                }
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

        const isHead = this.meshDesc.headMesh === this.meshDesc.mesh

        this.updateBoneMatrix(instance)
        
        if (FLAGS.ANIMATE_SKELETON) {
            //non-facs animation is done in here
            this.updateBoneMatrix(instance, true)

            for (const bone of this.skeleton.bones) {
                const isFACS = this.meshDesc.fileMesh?.facs?.faceBoneNames.includes(bone.name)

                if (isFACS) {
                    const facsMesh = this.meshDesc.fileMesh
                    const facs = this.meshDesc.fileMesh?.facs
                    const head = this.getPartEquivalent(instance, "Head")

                    if (head && facsMesh && facs && facs.quantizedTransforms) {
                        const headSize = head.Prop("Size") as Vector3
                        const ogHeadSize = isHead ? new Vector3(...this.meshDesc.fileMesh.size) : getOriginalSize(head)
                        let headScale = divide(headSize.toVec3(), ogHeadSize.toVec3())
                        if (this.meshDesc.wasAutoSkinned) {
                            headScale = [1,1,1]
                        }

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
                                let jointCF = new CFrame()

                                const ogCF = this.originalBoneCFrames[this.bones.indexOf(bone)]
                                jointCF = ogCF.clone()
                                //find scale difference
                                const head = this.getPartEquivalent(instance, "Head")
                                if (head) {
                                    const headSize = head.Prop("Size") as Vector3
                                    const ogHeadSize = isHead ? new Vector3(...this.meshDesc.fileMesh.size) : getOriginalSize(head)

                                    let scale = divide(headSize.toVec3(), ogHeadSize.toVec3())
                                    if (this.meshDesc.wasAutoSkinned) {
                                        scale = [1,1,1]
                                    }

                                    //apply scale
                                    jointCF.Position = multiply(jointCF.Position, scale)
                                }

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
                                            console.log(faceControlName)
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
                                resultCF.Position = multiply(totalPosition.toVec3(), headScale)

                                setBoneToCFrame(bone, jointCF.multiply(resultCF))
                                break
                            }
                        }
                    }
                }
            }
        }

        this.updateMatrixWorld()
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
        return meshDesc.canHaveSkinning && meshDesc.fileMesh && meshDesc.fileMesh.skinning && meshDesc.fileMesh.skinning.subsets.length > 0 && meshDesc.fileMesh.skinning.skinnings.length > 0
    }
}