import type { FileMesh, Vec3 } from "./mesh";
import { add, getDistIndexArray } from "./mesh-deform";
import { type KDNode } from "../misc/kd-tree-3";
import { WorkerPool } from "../misc/worker-pool";
import { FLAGS } from "../misc/flags";
import { time, timeEnd } from "../misc/logger";

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
        time(`RBFDeformerPatch.constructor.${this.id}`);
        this.mesh = mesh
        this.K = detailsCount

        this.meshVerts = new Float32Array(mesh.coreMesh.numverts * 3)
        for (let i = 0; i < mesh.coreMesh.numverts; i++) {
            const pos = mesh.coreMesh.getPos(i)

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

        //time(`RBFDeformerPatch.constructor.verts.${this.id}`);
        //get arrays of ref and dist verts that match in length and index
        const distVertArr = getDistIndexArray(refMesh, distMesh)
        const matchedIndices = []

        for (let i = 0; i < refMesh.coreMesh.numverts; i++) {
            if (ignoredIndices.includes(i)) continue

            const distVert = distVertArr[i]
            if (distVert !== undefined) {
                matchedIndices.push(i)
            }
        }

        this.refVerts = new Float32Array(matchedIndices.length * 3)
        this.distVerts = new Float32Array(matchedIndices.length * 3)

        for (let i = 0; i < matchedIndices.length; i++) {
            const matchedIndex = matchedIndices[i]

            const refPos = refMesh.coreMesh.getPos(matchedIndex)
            const distPos = distMesh.coreMesh.getPos(distVertArr[matchedIndex]!)

            this.refVerts[i * 3 + 0] = refPos[0]
            this.refVerts[i * 3 + 1] = refPos[1]
            this.refVerts[i * 3 + 2] = refPos[2]

            this.distVerts[i * 3 + 0] = distPos[0]
            this.distVerts[i * 3 + 1] = distPos[1]
            this.distVerts[i * 3 + 2] = distPos[2]
        }
        //console.log(refMesh.coreMesh.verts.length - this.refVerts.length)
        //timeEnd(`RBFDeformerPatch.constructor.verts.${this.id}`);

        //time(`RBFDeformerPatch.constructor.importants.${this.id}`);
        //add importants (verts added to every patch so the general mesh shape is always retained) also theyre picked kinda randomly
        this.importantIndices = new Uint16Array(importantsCount)

        const step = matchedIndices.length / importantsCount;
        for (let i = 0; i < importantsCount; i++) {
            const index = Math.floor(i * step)
            this.importantIndices[i] = (index)
        }

        //timeEnd(`RBFDeformerPatch.constructor.importants.${this.id}`);

        this.patchCount = patchCount
        /*
        //time(`RBFDeformerPatch.constructor.KD.${this.id}`);

        const points: Vec3[] = new Array(this.refVerts.length)
        const indices = new Array(this.refVerts.length)
        for (let i = 0; i < this.refVerts.length; i++) {
            points[i] = this.refVerts[i].position
            indices[i] = i
        }

        this.controlKD = buildKDTree(points, indices)
        //timeEnd(`RBFDeformerPatch.constructor.KD.${this.id}`);

        //time(`RBFDeformerPatch.constructor.patches.${this.id}`);
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
        //timeEnd(`RBFDeformerPatch.constructor.patches.${this.id}`);
        */
        timeEnd(`RBFDeformerPatch.constructor.${this.id}`);
    }

    async solveAsync() {
        if (this.refVerts.length === 0) {
            return
        }

        const [neighborIndicesBuf, weightsBuf, nearestPatchBuf] = (await WorkerPool.instance.work("RBFDeformerSolveAsync",
            [this.patchCount, this.K, this.epsilon, this.importantIndices.buffer, this.refVerts.buffer, this.distVerts.buffer, this.meshVerts.buffer, this.meshBones.buffer],
            [this.importantIndices.buffer, /*this.refVerts.buffer,*/ this.distVerts.buffer, this.meshVerts.buffer, this.meshBones.buffer]
        )) as [ArrayBuffer[], ArrayBuffer[], ArrayBuffer]

        time(`RBFDeformerPatch.solveAsync.unpack.${this.id}`)
        this.neighborIndices = neighborIndicesBuf.map(a => {
            return new Uint16Array(a)
        })

        this.weights = weightsBuf.map(a => {
            return new Float32Array(a)
        })

        this.nearestPatch = new Uint16Array(nearestPatchBuf)
        timeEnd(`RBFDeformerPatch.solveAsync.unpack.${this.id}`)
    }

    deform(i: number): Vec3 {
        if (!this.nearestPatch || !this.neighborIndices || !this.weights) {
            throw new Error("RBF has not been solved")
        }

        const vertLen = this.mesh.coreMesh.numverts

        const vec = i < vertLen ? this.mesh.coreMesh.getPos(i) : this.mesh.skinning.bones[i - vertLen].position

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

        time(`RBFDeformerPatch.deformMesh.${this.id}`);
        for (let i = 0; i < this.mesh.coreMesh.numverts; i++) {
            this.mesh.coreMesh.setPos(i, this.deform(i))
        }

        if (this.affectBones) {
            for (let i = 0; i < this.mesh.skinning.bones.length; i++) {
                const bone = this.mesh.skinning.bones[i]
                bone.position = this.deform(this.mesh.coreMesh.numverts + i)
            }
        }
        timeEnd(`RBFDeformerPatch.deformMesh.${this.id}`);
    }
}