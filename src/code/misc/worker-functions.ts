import type { Vec3 } from "../mesh/mesh"
import { buildKDTree, knnSearch, nearestSearch } from "./kd-tree-3"
import GenericWorker from "./generic-worker?worker&inline"

function luDecompose(A: Float32Array[]) {
    const n = A.length
    const LU = A
    const P = new Int32Array(n)

    for (let i = 0; i < n; i++) P[i] = i

    for (let k = 0; k < n; k++) {
        //pivot
        let pivot = k
        for (let i = k + 1; i < n; i++) {
            if (Math.abs(LU[i][k]) > Math.abs(LU[pivot][k])) {
                pivot = i
            }
        }

        //swap rows
        if (pivot !== k) {
            const tmpRow = LU[k]
            LU[k] = LU[pivot]
            LU[pivot] = tmpRow

            const tmpP = P[k]
            P[k] = P[pivot]
            P[pivot] = tmpP
        }

        //elimination
        const pivotVal = LU[k][k]
        for (let i = k + 1; i < n; i++) {
            LU[i][k] /= pivotVal
            const mult = LU[i][k]
            const rowI = LU[i]
            const rowK = LU[k]
            for (let j = k + 1; j < n; j++) {
                rowI[j] -= mult * rowK[j]
            }
        }
    }

    return { LU, P }
}


function luSolve({ LU, P }: { LU: Float32Array[], P: Int32Array }, b: Float32Array) {
    const n = LU.length
    const x = new Float32Array(n)

    //apply permutation
    for (let i = 0; i < n; i++) {
        x[i] = b[P[i]]
    }

    //forward substitution (Ly = Pb)
    for (let i = 0; i < n; i++) {
        const row = LU[i]
        let sum = x[i]
        for (let j = 0; j < i; j++) {
            sum -= row[j] * x[j]
        }
        x[i] = sum
    }

    //backward substitution (Ux = y)
    for (let i = n - 1; i >= 0; i--) {
        const row = LU[i]
        let sum = x[i]
        for (let j = i + 1; j < n; j++) {
            sum -= row[j] * x[j]
        }
        x[i] = sum / row[i]
    }

    return x
}

function patchRBFWorkerFunc([_A, _bx, _by, _bz]: [ArrayBuffer[], ArrayBuffer, ArrayBuffer, ArrayBuffer]) {
    //convert buffers to Float32Array
    const A = _A.map(r => new Float32Array(r))
    const bx = new Float32Array(_bx)
    const by = new Float32Array(_by)
    const bz = new Float32Array(_bz)

    //solve for weights
    const LU = luDecompose(A)

    const wx = luSolve(LU, bx)
    const wy = luSolve(LU, by)
    const wz = luSolve(LU, bz)

    //combine weights of x,y,z into a Float32Array
    const n = wx.length
    const result = new Float32Array(n * 3)

    for (let i = 0; i < n; i++) {
        result[i*3 + 0] = wx[i]
        result[i*3 + 1] = wy[i]
        result[i*3 + 2] = wz[i]
    }

    return result.buffer
}

function RBFDeformerSolveAsync([patchCount, detailsCount, epsilon, importantIndicesBuf, refVertsBuf, distVertsBuf, meshVertsBuf, meshBonesBuf]:
                                [number, number, number, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]) {
    const importantIndices = new Uint16Array(importantIndicesBuf)
    const refVerts = new Float32Array(refVertsBuf)
    const distVerts = new Float32Array(distVertsBuf)
    const meshVerts = new Float32Array(meshVertsBuf)
    const meshBones = new Float32Array(meshBonesBuf)
    
    //console.time(`RBFDeformerPatch.constructor.KD.${this.id}`);
    const refCount = refVerts.length / 3
    const meshVertCount = meshVerts.length / 3
    const meshBoneCount = meshBones.length / 3

    const points: Vec3[] = new Array(refCount)
    const indices = new Array(refCount)
    for (let i = 0; i < refCount; i++) {
        const refPos: Vec3 = [refVerts[i*3 + 0], refVerts[i*3 + 1], refVerts[i*3 + 2]]
        points[i] = refPos
        indices[i] = i
    }

    const controlKD = buildKDTree(points, indices)
    //console.timeEnd(`RBFDeformerPatch.constructor.KD.${this.id}`);

    //console.time(`RBFDeformerPatch.constructor.patches.${this.id}`);
    //create patches at kinda random positions
    const step = Math.max(1, Math.floor(refCount / patchCount))
    const patchCenters: Vec3[] = []
    const patchCenterIndices: number[] = []

    for (let i = 0; i < refCount; i += step) {
        const refPos: Vec3 = [refVerts[i*3 + 0], refVerts[i*3 + 1], refVerts[i*3 + 2]]

        patchCenters.push(refPos)
        patchCenterIndices.push(i)
        if (patchCenters.length >= patchCount) break
    }

    //console.timeEnd(`RBFDeformerPatch.constructor.patches.${this.id}`);
    //console.timeEnd(`RBFDeformerPatch.constructor.${this.id}`);

    //console.time(`RBFDeformerPatch.solve.${this.id}`);

    //console.time(`RBFDeformerPatch.solve.patches.${this.id}`);
    const neighborIndices: Uint16Array[] = new Array(patchCenters.length)
    const weights: Float32Array[] = new Array(patchCenters.length)

    //console.timeEnd(`RBFDeformerPatch.solve.patches.${this.id}`);

    //console.time(`RBFDeformerPatch.solve.KDRebuild.${this.id}`);
    //build patch kd tree
    const patchIndices = patchCenters.map((_, i) => i)
    const patchKD = buildKDTree(patchCenters, patchIndices)
    //console.timeEnd(`RBFDeformerPatch.solve.KDRebuild.${this.id}`);

    //console.time(`RBFDeformerPatch.solve.usedPatches.${this.id}`);
    //get used patches
    const isUsedArr = new Array(patchCenters.length).fill(false)
    const nearestPatch = new Uint16Array(meshVertCount + meshBoneCount)

    for (let i = 0; i < meshVertCount; i++) {
        const vec: Vec3 = [meshVerts[i*3 + 0], meshVerts[i*3 + 1], meshVerts[i*3 + 2]]

        //find nearest patch center
        const nearestPatchNode = nearestSearch(patchKD, vec)
        isUsedArr[nearestPatchNode.index] = true
        nearestPatch[i] = nearestPatchNode.index
    }

    for (let i = 0; i < meshBoneCount; i++) {
        const vec: Vec3 = [meshBones[i*3 + 0], meshBones[i*3 + 1], meshBones[i*3 + 2]]

        //find nearest patch center
        const nearestPatchNode = nearestSearch(patchKD, vec)
        isUsedArr[nearestPatchNode.index] = true
        nearestPatch[i + meshVertCount] = nearestPatchNode.index
    }

    //console.timeEnd(`RBFDeformerPatch.solve.usedPatches.${this.id}`);

    //console.time(`RBFDeformerPatch.solve.patchNeighbors.${this.id}`);
    //get neighbors of used patches
    for (let i = 0; i < patchCenters.length; i++) {
        if (!isUsedArr[i]) {
            continue
        }

        const centerPos = patchCenters[i]

        //find nearest verts and add importants
        const neighbors = knnSearch(controlKD, centerPos, detailsCount)

        const foundNeighborIndices = neighbors.map(n => n.index)
        for (const important of importantIndices) {
            if (!foundNeighborIndices.includes(important)) {
                foundNeighborIndices.push(important)
            }
        }

        neighborIndices[i] = new Uint16Array(foundNeighborIndices)
    }
    //console.timeEnd(`RBFDeformerPatch.solve.patchNeighbors.${this.id}`);

    //create weights
    //let totalSkipped = 0

    //console.time(`RBFDeformerPatch.solve.A.${this.id}`)
    const A_array: Float32Array[][] = new Array(patchCenters.length)
    for (let p = 0; p < patchCenters.length; p++) {
        const patchNeighborIndices = neighborIndices[p]
        if (!patchNeighborIndices) continue

        const K = patchNeighborIndices.length

        //pre-fetch positions
        const positions = new Array(patchNeighborIndices.length) 
        for (let i = 0; i < patchNeighborIndices.length; i++) {
            const j = patchNeighborIndices[i]
            const refPos: Vec3 = [refVerts[j*3+0], refVerts[j*3+1], refVerts[j*3+2]]
            positions[i] = refPos
        }

        //build distance matrix A
        const A: Float32Array[] = new Array(K)
        for (let i = 0; i < K; i++) {
            A[i] = new Float32Array(K)
        }
        for (let i = 0; i < K; i++) {
            const [pix, piy, piz] = positions[i]
            for (let j = i+1; j < K; j++) {
                const [pjx, pjy, pjz] = positions[j]

                const dist = Math.sqrt((pix - pjx)*(pix - pjx) + (piy - pjy)*(piy - pjy) + (piz - pjz)*(piz - pjz))

                A[i][j] = dist
                A[j][i] = dist
            }
            A[i][i] = epsilon
        }

        A_array[p] = A
    }
    //console.timeEnd(`RBFDeformerPatch.solve.A.${this.id}`)

    //console.time(`RBFDeformerPatch.solve.weightsPromise.${this.id}`);
    for (let p = 0; p < patchCenters.length; p++) {
        //skip unused patches
        if (!isUsedArr[p]) {
            //totalSkipped += 1
            continue
        }

        const patchNeighborIndices = neighborIndices[p]

        const K = patchNeighborIndices.length
        //if (K === 0) continue

        const usedRef: Vec3[] = new Array(K)
        const usedDist: Vec3[] = new Array(K)

        for (let i = 0; i < K; i++) {
            const idx = patchNeighborIndices[i]

            const j = idx
            const refPos: Vec3 = [refVerts[j*3+0], refVerts[j*3+1], refVerts[j*3+2]]
            const distPos: Vec3 = [distVerts[j*3+0], distVerts[j*3+1], distVerts[j*3+2]]

            usedRef[i] = refPos
            usedDist[i] = distPos
        }

        const A = A_array[p]

        //create offset arrays
        const bx = new Float32Array(K)
        const by = new Float32Array(K)
        const bz = new Float32Array(K)

        for (let i = 0; i < K; i++) {
            const dr = usedDist[i]
            const rr = usedRef[i]

            bx[i] = dr[0] - rr[0]
            by[i] = dr[1] - rr[1]
            bz[i] = dr[2] - rr[2]
        }

        const Abuffers = A.map(r => r.buffer) as ArrayBuffer[]

        weights[p] = new Float32Array(patchRBFWorkerFunc([Abuffers, bx.buffer, by.buffer, bz.buffer]))
    }
    //console.timeEnd(`RBFDeformerPatch.solve.weightsPromise.${this.id}`);

    //console.log("skipped patches", totalSkipped)
    //console.timeEnd(`RBFDeformerPatch.solve.${this.id}`);

    const neighborIndicesBuf = neighborIndices.map(a => {
        return a.buffer
    })
    const weightsBuf = weights.map(a => {
        return a.buffer
    })

    return [neighborIndicesBuf, weightsBuf, nearestPatch.buffer]
} 

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const WorkerTypeToFunction: {[K in string]: Function} = {
    "patchRBF": patchRBFWorkerFunc,
    "RBFDeformerSolveAsync": RBFDeformerSolveAsync
}

export function getWorkerOnMessage() {
    return function(event: MessageEvent) {
        const [id, type, data]: [number, string, unknown] = event.data
        //console.log("Worker recieved message", [id, type, data])

        const func = WorkerTypeToFunction[type]
        self.postMessage([id, func(data)])
    }
}

export function DefaultGetWorkerFunc() {
    return new GenericWorker()
}