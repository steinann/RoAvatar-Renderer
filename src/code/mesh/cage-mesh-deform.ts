import * as math from "mathjs";
import type { FileMesh, FileMeshVertex, Vec3 } from "./mesh";
import { add, distance, getDistVertArray, minus } from "./mesh-deform";
import { type KDNode } from "../misc/kd-tree-3";
import { WorkerPool } from "../misc/worker-pool";
import { FLAGS } from "../misc/flags";

//200 ~50ms -> 2
//100 ~26ms -> 4
//50 ~15.6ms -> 6
//25 ~4.5ms -> 22
//16 ~3ms -> 33
//8 ~3ms -> 33

/**
 * This is a naive (think thats what its called) implementation of the RBF deformer, it is extremely slow
 * Use RBFDeformerPatch instead
 */
export class RBFDeformer {
    refVerts: FileMeshVertex[] = []
    distVerts: FileMeshVertex[] = []

    weights: Vec3[] | undefined

    constructor(refMesh: FileMesh, distMesh: FileMesh) {
        let itsTime = 3 //we use this to skip verts because doing all is way too slow, even when skipping some its too slow

        //create arrays of refVerts and distVerts so that we can guarantee theyre identical in length
        const distVertArr = getDistVertArray(refMesh, distMesh)
        for (let i = 0; i < refMesh.coreMesh.verts.length; i++) {
            const distVert = distVertArr[i]
            if (distVert) {
                itsTime -= 1
                if (itsTime == 0) {
                    this.refVerts.push(refMesh.coreMesh.verts[i].clone())
                    this.distVerts.push(distVert.clone())
                    itsTime = 3
                }
            }
        }
        console.log(refMesh.coreMesh.verts.length)
        console.log(this.refVerts.length)
    }

    solve() {
        console.time("RBFDeformer.solve")

        console.time("RBFDeformer.solve.influenceMatrixArray")
        //create matrix VERT_COUNT x VERT_COUNT that defines influences each vertex has on every other vertex
        const influenceMatrixArray: number[][] = new Array(this.refVerts.length)

        for (let i = 0; i < this.refVerts.length; i++) {
            const refVert = this.refVerts[i]
            influenceMatrixArray[i] = new Array(this.refVerts.length)

            for (let j = 0; j < this.refVerts.length; j++) {
                const refVert2 = this.refVerts[j]

                if (i !== j) { //make sure vert doesnt use its own deformation as a reference
                    const influence = distance(refVert.position, refVert2.position)
                    influenceMatrixArray[i][j] = influence
                } else {
                    influenceMatrixArray[i][j] = 0 + 1e-6
                }
            }
        }

        console.log(influenceMatrixArray)

        const influenceMatrix = math.matrix(influenceMatrixArray)
        console.timeEnd("RBFDeformer.solve.influenceMatrixArray")

        console.time("RBFDeformer.solve.offsetMatrix")
        //create offset matrix VERT_COUNT x 3
        const offsetMatrixArrayX: number[] = new Array(this.refVerts.length)
        const offsetMatrixArrayY: number[] = new Array(this.refVerts.length)
        const offsetMatrixArrayZ: number[] = new Array(this.refVerts.length)
        for (let i = 0; i < this.refVerts.length; i++) {
            const refVert = this.refVerts[i]
            const distVert = this.distVerts[i]

            const offset = minus(distVert.position, refVert.position)

            offsetMatrixArrayX[i] = offset[0]
            offsetMatrixArrayY[i] = offset[1]
            offsetMatrixArrayZ[i] = offset[2]
        }
        console.log("A min/max", Math.min(...influenceMatrixArray[0]), Math.max(...influenceMatrixArray[0]));

        const offsetMatrixX = math.matrix(offsetMatrixArrayX)
        const offsetMatrixY = math.matrix(offsetMatrixArrayY)
        const offsetMatrixZ = math.matrix(offsetMatrixArrayZ)
        console.timeEnd("RBFDeformer.solve.offsetMatrix")

        console.time("RBFDeformer.solve.weights")
        //solve for weights
        const LU = math.lup(influenceMatrix)
        const weightMatrixX = math.lusolve(LU, offsetMatrixX)
        const weightMatrixY = math.lusolve(LU, offsetMatrixY)
        const weightMatrixZ = math.lusolve(LU, offsetMatrixZ)
        const weightArrayX = weightMatrixX.toArray().flat() as number[]
        const weightArrayY = weightMatrixY.toArray().flat() as number[]
        const weightArrayZ = weightMatrixZ.toArray().flat() as number[]
        console.log(weightMatrixX)
        console.log(weightArrayX)
        console.log(weightMatrixY)
        console.log(weightArrayY)
        console.log(weightMatrixZ)
        console.log(weightArrayZ)
        console.timeEnd("RBFDeformer.solve.weights")

        console.time("RBFDeformer.solve.weightsUnpack")
        this.weights = new Array(weightArrayX.length)
        for (let i = 0; i < weightArrayX.length; i++) {
            this.weights[i] = [weightArrayX[i], weightArrayY[i], weightArrayZ[i]]
        }
        console.timeEnd("RBFDeformer.solve.weightsUnpack")

        console.timeEnd("RBFDeformer.solve")
    }
    
    deform(vec: Vec3) {
        if (!this.weights) {
            throw new Error("RBF has not been solved")
        }

        let dx = 0
        let dy = 0
        let dz = 0

        for (let i = 0; i < this.refVerts.length; i++) {
            const vert = this.refVerts[i]

            const influence = distance(vec, vert.position)

            dx += influence * this.weights[i][0]
            dy += influence * this.weights[i][1]
            dz += influence * this.weights[i][2]
        }

        return add(vec, [dx,dy,dz])
    }

    deformMesh(mesh: FileMesh) {
        console.time("RBFDeformer.deformMesh")
        for (const vert of mesh.coreMesh.verts) {
            vert.position = this.deform(vert.position)
        }
        console.timeEnd("RBFDeformer.deformMesh")
    }
}

let rbfDeformerIdCount = 0

export class RBFDeformerPatch {
    mesh: FileMesh

    refVerts: Float32Array = new Float32Array();
    distVerts: Float32Array = new Float32Array();

    importantIndices: Uint16Array = new Uint16Array();

    controlKD: KDNode | null = null  // KD tree over refVerts
    patchKD: KDNode | null = null    // KD tree over patch centers

    meshVerts: Float32Array
    meshBones: Float32Array

    nearestPatch?: Uint16Array //nearest patch for each vert in mesh
    neighborIndices?: Uint16Array[]
    weights?: Float32Array[]

    K: number   // neighbors per patch
    patchCount: number    // how many patches you want
    epsilon: number = 1e-6; // avoid matrix from being singular
    affectBones: boolean = true

    id: number = rbfDeformerIdCount++

    constructor(refMesh: FileMesh, distMesh: FileMesh, mesh: FileMesh, ignoredIndices: number[] = [], patchCount = FLAGS.RBF_PATCH_COUNT, detailsCount = FLAGS.RBF_PATCH_DETAIL_SAMPLES, importantsCount = FLAGS.RBF_PATCH_SHAPE_SAMPLES) {
        console.time(`RBFDeformerPatch.constructor.${this.id}`);
        this.mesh = mesh
        this.K = detailsCount

        this.meshVerts = new Float32Array(mesh.coreMesh.verts.length * 3)
        for (let i = 0; i < mesh.coreMesh.verts.length; i++) {
            const pos = mesh.coreMesh.verts[i].position

            this.meshVerts[i*3 + 0] = pos[0]
            this.meshVerts[i*3 + 1] = pos[1]
            this.meshVerts[i*3 + 2] = pos[2]
        }
        
        this.meshBones = new Float32Array(mesh.skinning.bones.length * 3)
        for (let i = 0; i < mesh.skinning.bones.length; i++) {
            const pos = mesh.skinning.bones[i].position

            this.meshBones[i*3 + 0] = pos[0]
            this.meshBones[i*3 + 1] = pos[1]
            this.meshBones[i*3 + 2] = pos[2]
        }

        //console.time(`RBFDeformerPatch.constructor.verts.${this.id}`);
        //get arrays of ref and dist verts that match in length and index
        const distVertArr = getDistVertArray(refMesh, distMesh)
        const matchedIndices = []

        for (let i = 0; i < refMesh.coreMesh.verts.length; i++) {
            if (ignoredIndices.includes(i)) continue

            const distVert = distVertArr[i]
            if (distVert) {
                matchedIndices.push(i)
            }
        }

        this.refVerts = new Float32Array(matchedIndices.length * 3)
        this.distVerts = new Float32Array(matchedIndices.length * 3)

        for (let i = 0; i < matchedIndices.length; i++) {
            const matchedIndex = matchedIndices[i]

            const refPos = refMesh.coreMesh.verts[matchedIndex].position
            const distPos = distVertArr[matchedIndex]!.position

            this.refVerts[i * 3 + 0] = refPos[0]
            this.refVerts[i * 3 + 1] = refPos[1]
            this.refVerts[i * 3 + 2] = refPos[2]

            this.distVerts[i * 3 + 0] = distPos[0]
            this.distVerts[i * 3 + 1] = distPos[1]
            this.distVerts[i * 3 + 2] = distPos[2]
        }
        //console.log(refMesh.coreMesh.verts.length - this.refVerts.length)
        //console.timeEnd(`RBFDeformerPatch.constructor.verts.${this.id}`);

        //console.time(`RBFDeformerPatch.constructor.importants.${this.id}`);
        //add importants (verts added to every patch so the general mesh shape is always retained) also theyre picked kinda randomly
        this.importantIndices = new Uint16Array(importantsCount)

        const step = matchedIndices.length / importantsCount;
        for (let i = 0; i < importantsCount; i++) {
            const index = Math.floor(i * step)
            this.importantIndices[i] = (index)
        }

        //console.timeEnd(`RBFDeformerPatch.constructor.importants.${this.id}`);

        this.patchCount = patchCount
        /*
        //console.time(`RBFDeformerPatch.constructor.KD.${this.id}`);

        const points: Vec3[] = new Array(this.refVerts.length)
        const indices = new Array(this.refVerts.length)
        for (let i = 0; i < this.refVerts.length; i++) {
            points[i] = this.refVerts[i].position
            indices[i] = i
        }

        this.controlKD = buildKDTree(points, indices)
        //console.timeEnd(`RBFDeformerPatch.constructor.KD.${this.id}`);

        //console.time(`RBFDeformerPatch.constructor.patches.${this.id}`);
        //create patches at kinda random positions
        const step = Math.max(1, Math.floor(this.refVerts.length / this.patchCount))
        const patchCenters: Vec3[] = []
        const patchCenterIndices: number[] = []

        for (let i = 0; i < this.refVerts.length; i += step) {
            patchCenters.push([...this.refVerts[i].position] as Vec3)
            patchCenterIndices.push(i)
            if (patchCenters.length >= this.patchCount) break
        }

        this.patchCenters = patchCenters
        //console.timeEnd(`RBFDeformerPatch.constructor.patches.${this.id}`);
        */
        console.timeEnd(`RBFDeformerPatch.constructor.${this.id}`);
    }

    async solveAsync() {
        if (this.refVerts.length === 0) {
            return
        }

        const [neighborIndicesBuf, weightsBuf, nearestPatchBuf] = (await WorkerPool.instance.work("RBFDeformerSolveAsync",
            [this.patchCount, this.K, this.epsilon, this.importantIndices.buffer, this.refVerts.buffer, this.distVerts.buffer, this.meshVerts.buffer, this.meshBones.buffer],
            [this.importantIndices.buffer, /*this.refVerts.buffer,*/ this.distVerts.buffer, this.meshVerts.buffer, this.meshBones.buffer]
        )) as [ArrayBuffer[], ArrayBuffer[], ArrayBuffer]

        console.time(`RBFDeformerPatch.solveAsync.unpack.${this.id}`)
        this.neighborIndices = neighborIndicesBuf.map(a => {
            return new Uint16Array(a)
        })

        this.weights = weightsBuf.map(a => {
            return new Float32Array(a)
        })

        this.nearestPatch = new Uint16Array(nearestPatchBuf)
        console.timeEnd(`RBFDeformerPatch.solveAsync.unpack.${this.id}`)
    }

    deform(i: number): Vec3 {
        if (!this.nearestPatch || !this.neighborIndices || !this.weights) {
            throw new Error("RBF has not been solved")
        }

        const vertLen = this.mesh.coreMesh.verts.length

        const vec = i < vertLen ? this.mesh.coreMesh.verts[i].position : this.mesh.skinning.bones[i - vertLen].position

        //find nearest patch center
        const idx = this.nearestPatch[i]

        const neighborIndices = this.neighborIndices[idx]
        const weights = this.weights[idx]

        if (!weights) {
            throw new Error("Patch is missing weights")
        }

        let dx = 0, dy = 0, dz = 0

        //use patch weights to deform
        for (let i = 0; i < neighborIndices.length; i++) {
            const j = neighborIndices[i]

            //const refP: Vec3 = [this.refVerts[j*3 + 0], this.refVerts[j*3 + 1], this.refVerts[j*3 + 2]]
            //const r = distance(vec, refP)
            const r = Math.sqrt(Math.pow(vec[0] - this.refVerts[j*3 + 0], 2) + Math.pow(vec[1] - this.refVerts[j*3 + 1], 2) + Math.pow(vec[2] - this.refVerts[j*3 + 2], 2))
            const phi = r // kernel

            dx += phi * weights[i*3 + 0]
            dy += phi * weights[i*3 + 1]
            dz += phi * weights[i*3 + 2]
        }

        return add(vec, [dx, dy, dz])
    }

    deformMesh() {
        if (this.refVerts.length === 0) {
            return
        }

        console.time(`RBFDeformerPatch.deformMesh.${this.id}`);
        for (let i = 0; i < this.mesh.coreMesh.verts.length; i++) {
            const vert = this.mesh.coreMesh.verts[i]
            vert.position = this.deform(i)
        }

        if (this.affectBones) {
            for (let i = 0; i < this.mesh.skinning.bones.length; i++) {
                const bone = this.mesh.skinning.bones[i]
                bone.position = this.deform(this.mesh.coreMesh.verts.length + i)
            }
        }
        console.timeEnd(`RBFDeformerPatch.deformMesh.${this.id}`);
    }
}