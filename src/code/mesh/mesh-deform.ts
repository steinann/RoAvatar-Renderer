import * as THREE from 'three';
import type { FileMesh, FileMeshSkinning, FileMeshSubset, Mat3x3, Triangle, Vec2, Vec3 } from "./mesh"
import { CFrame, Vector3 } from "../rblx/rbx"
import { buildKDTree, nearestSearch } from '../misc/kd-tree-3';
import { FLAGS } from '../misc/flags';
import { MeshCollider, Ray } from '../misc/collision';
import { warn } from '../misc/logger';

const WeightCache = new Map<string,WeightChunk[]>()

export function hashVec2(x: number,y: number) {
    return Math.round(x * 1000) * 10000 + Math.round(y * 1000)
}

export function hashVec3(x: number,y: number,z: number, distance: number) {
    const d = distance
    return Math.floor(x / d) * d * 10000000 + Math.floor(y / d) * d * 10000 + Math.floor(z / d) * d
}

export function hashVec3Safe(a: number | bigint, b: number | bigint, c: number | bigint) {
    [a,b,c] = [a,b,c].sort()

    a = BigInt(a)
    b = BigInt(b)
    c = BigInt(c)

    return (a * 100n) + (b * 10n) + (c * 1n)
}

export function calculateMagnitude3D(x: number, y: number, z: number) {
    return Math.sqrt(x * x + y * y + z * z);
}

export function magnitude(v: Vec3): number {
    return calculateMagnitude3D(v[0],v[1],v[2])
}

export function floor(v0: Vec3): Vec3 {
    return [Math.floor(v0[0]), Math.floor(v0[1]), Math.floor(v0[2])]
}

export function divide(v0: Vec3, v1: Vec3): Vec3 {
    return [v0[0] / v1[0], v0[1] / v1[1], v0[2] / v1[2]]
}

export function multiply(v0: Vec3, v1: Vec3): Vec3 {
    return [v0[0] * v1[0], v0[1] * v1[1], v0[2] * v1[2]]
}

export function add(v0: Vec3, v1: Vec3): Vec3 {
    return [v0[0] + v1[0], v0[1] + v1[1], v0[2] + v1[2]]
}

export function minus(v0: Vec3, v1: Vec3): Vec3 {
    return [v0[0] - v1[0], v0[1] - v1[1], v0[2] - v1[2]]
}

export function dot(v0: Vec3, v1: Vec3): number {
    return v0[0]*v1[0] + v0[1]*v1[1] + v0[2]*v1[2]
}

export function normalize(v: Vec3) {
    const mag = magnitude(v)
    return divide(v, [mag, mag, mag])
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  const ax = a[0], ay = a[1], az = a[2]
  const bx = b[0], by = b[1], bz = b[2]

  const cx = ay * bz - az * by
  const cy = az * bx - ax * bz
  const cz = ax * by - ay * bx

  return [cx, cy, cz]
}

export function multiplyMatrixVector(m: Mat3x3, v: Vec3): Vec3 {
    return [
        m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
        m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
        m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
    ]
}

export function clamp(v0: Vec3, lower: Vec3, higher: Vec3): Vec3 {
    return [
        Math.min(Math.max(lower[0], v0[0]), higher[0]),
        Math.min(Math.max(lower[1], v0[1]), higher[1]),
        Math.min(Math.max(lower[2], v0[2]), higher[2])
    ]
}

export function distance(v0: Vec3, v1: Vec3): number {
    return magnitude(minus(v1, v0))
}

export function gaussian_rbf(v0: Vec3, v1: Vec3,sigma = 0.04) {
    return Math.exp(-((Math.pow(magnitude(minus(v0,v1)),2))/(2*sigma*sigma)))
}

export function getUVtoIndicesMap(mesh: FileMesh): Map<number,number[]> {
    const map = new Map<number,number[]>()

    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        const uv = mesh.coreMesh.getUV(i)

        const uvhash = hashVec2(uv[0], uv[1])
        const arr = map.get(uvhash)
        if (arr) {
            arr.push(i)
        } else {
            map.set(uvhash, [i])
        }
    }

    return map
}

export function getUVtoIndexMap(mesh: FileMesh) {
    const map = new Map<number,number>()

    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        const uv = mesh.coreMesh.getUV(i)

        const uvhash = hashVec2(uv[0], uv[1])
        map.set(uvhash, i)
    }

    return map
}

// Source: https://gamedev.stackexchange.com/questions/23743/whats-the-most-efficient-way-to-find-barycentric-coordinates
// Compute barycentric coordinates (u, v, w) for
// point p with respect to triangle (a, b, c)
export function barycentric(p: Vec3, triangle: Triangle): Vec3 {
    const a = triangle[0], b = triangle[1], c = triangle[2]
    const v0: Vec3 = minus(b, a), v1 = minus(c, a), v2 = minus(p, a);
    const d00: number = dot(v0, v0);
    const d01: number = dot(v0, v1);
    const d11: number = dot(v1, v1);
    const d20: number = dot(v2, v0);
    const d21: number = dot(v2, v1);
    const denom: number = d00 * d11 - d01 * d01;
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1.0 - v - w;

    return [u, v, w];
}

export function triangleNormal(triangle: Triangle): Vec3 {
    const a = triangle[0], b = triangle[1], c = triangle[2]
    const v: Vec3 = minus(b, a);
    const w: Vec3 = minus(c, a);
    const N: Vec3 = cross(v, w);
    const Nnormalized: Vec3 = normalize(N)

    return Nnormalized;
}

// Source: https://stackoverflow.com/questions/2924795/fastest-way-to-compute-point-to-triangle-distance-in-3d
export function closestPointTriangle(p: Vec3, triangle: Triangle): Vec3 {
    const a = triangle[0], b = triangle[1], c = triangle[2]

    const ab: Vec3 = minus(b, a);
    const ac: Vec3 = minus(c, a);
    const ap: Vec3 = minus(p, a);

    const d1: number = dot(ab, ap);
    const d2: number = dot(ac, ap);
    if (d1 <= 0.0 && d2 <= 0.0) return a; //#1

    const bp: Vec3 = minus(p, b);
    const d3: number = dot(ab, bp);
    const d4: number = dot(ac, bp);
    if (d3 >= 0.0 && d4 <= d3) return b; //#2

    const cp: Vec3 = minus(p, c);
    const d5: number = dot(ab, cp);
    const d6: number = dot(ac, cp);
    if (d6 >= 0.0 && d5 <= d6) return c; //#3

    const vc: number = d1 * d4 - d3 * d2;
    if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0)
    {
        const v: number = d1 / (d1 - d3);
        return add(a, multiply([v,v,v], ab)); //#4
    }

    const vb: number = d5 * d2 - d1 * d6;
    if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0)
    {
        const v: number = d2 / (d2 - d6);
        return add(a, multiply([v,v,v], ac)); //#5
    }

    const va: number = d3 * d6 - d5 * d4;
    if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0)
    {
        const v: number = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return add(b, multiply([v,v,v], minus(c, b))); //#6
    }

    const denom: number = 1.0 / (va + vb + vc);
    const v: number = vb * denom;
    const w: number = vc * denom;
    return add(add(a, multiply([v,v,v], ab)), multiply([w,w,w], ac)); //#0
}

export function averageVec3(vecs: Vec3[]) {
    let total: Vec3 = [0,0,0]

    for (const vec of vecs) {
        total = add(total, vec)
    }

    total = divide(total, [vecs.length, vecs.length, vecs.length])

    return total
}

export function buildFaceKD(mesh: FileMesh) {
    //build face kd tree
    const faceCenters = new Array(mesh.coreMesh.numfaces)
    const faceIndices = new Array(mesh.coreMesh.numfaces)

    for (let i = 0; i < mesh.coreMesh.numfaces; i++) {
        const triangle = mesh.coreMesh.getTriangle(i)

        const [va,vb,vc] = triangle

        const center = divide(add(add(va, vb), vc), [3,3,3])

        faceCenters[i] = center
        faceIndices[i] = i
    }

    const faceKD = buildKDTree(faceCenters, faceIndices)

    return faceKD
}

export function buildVertKD(mesh: FileMesh) {
    //build vert kd tree
    const vertCenters = new Array(mesh.coreMesh.numverts)
    const vertIndices = new Array(mesh.coreMesh.numverts)
    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        vertCenters[i] = mesh.coreMesh.getPos(i)
        vertIndices[i] = i
    }

    const vertKD = buildKDTree(vertCenters, vertIndices)

    return vertKD
}

export function inheritUV(to: FileMesh, from: FileMesh) {
    const meshCollider = new MeshCollider(to)

    const faceKD = buildFaceKD(from)

    //for each to vert
    for (let i = 0; i < to.coreMesh.numverts; i++) {
        //const vert = to.coreMesh.verts[i]
        const pos = to.coreMesh.getPos(i)

        //find closest face and verts
        const closest = nearestSearch(faceKD, pos)
        const closestI = closest.index

        const face = from.coreMesh.getFace(closestI)
        const va = from.coreMesh.getUV(face[0])
        const vb = from.coreMesh.getUV(face[1])
        const vc = from.coreMesh.getUV(face[2])

        //do baycentric math to get new uv
        const triangle = from.coreMesh.getTriangle(closestI)

        const closestPointPos = closestPointTriangle(pos, triangle)
        const barycentricPos = barycentric(closestPointPos, triangle)

        const newUV: Vec2 = [
            barycentricPos[0] * va[0] + barycentricPos[1] * vb[0] + barycentricPos[2] * vc[0],
            barycentricPos[0] * va[1] + barycentricPos[1] * vb[1] + barycentricPos[2] * vc[1],
        ]

        //potentially invalidate uv
        const ray = new Ray(pos, closestPointPos)
        if (meshCollider.raycast(ray)) {
            newUV[0] = -Infinity
            newUV[1] = -Infinity
        }

        if (magnitude(minus(closestPointPos, pos)) > 0.1) { //invalidates uv
            newUV[0] = -Infinity
            newUV[1] = -Infinity
        }

        to.coreMesh.setUV(i, newUV)
    }

    //delete verts with invalid uvs
    //for (let i = to.coreMesh.verts.length - 1; i >= 0; i--) {
    //    const vert = to.coreMesh.verts[i]
    //    if (vert.uv[0] < 0 || vert.uv[0] > 1 || vert.uv[1] < 0 || vert.uv[1] > 1) {
    //        to.deleteVert(i)
    //    }
    //}
}

export function transferSkeleton(to: FileMesh, from: FileMesh) {
    if (from.skinning.skinnings.length < 1) {
        warn(false, `From mesh has no skeleton that can be inherited`)
        return
    }

    to.skinning = from.skinning.clone()
    to.skinning.numSkinnings = to.coreMesh.numverts
    to.skinning.skinnings = new Array(to.skinning.numSkinnings)

    const distIndexArr = getDistIndexArray(to, from)
    const newSkinDatas: [number, FileMeshSkinning, number][] = new Array(to.coreMesh.numverts)

    //get new skinning data for each to vert
    for (let i = 0; i < to.coreMesh.numverts; i++) {
        let closestI = distIndexArr[i]
        if (closestI === undefined) {
            warn(false, "did not find matching vert during transfer")
            closestI = 0
        }

        const closestSkinning = from.skinning.skinnings[closestI]
        const closestSubsetIndex = from.skinning.getSubsetIndex(closestI)

        newSkinDatas[i] = [closestSubsetIndex, closestSkinning, i]
    }

    newSkinDatas.sort((a, b) => {return a[0] - b[0]})

    //update mesh to use new data
    const newSubsets: FileMeshSubset[] = []
    const newVerts: number[] = []
    const newSkinnings: FileMeshSkinning[] = []

    const toSubsetToFromSubsetMap = new Map<FileMeshSubset,FileMeshSubset>()

    for (let i = 0; i < newSkinDatas.length; i++) {
        const newSkinData = newSkinDatas[i]

        const currentSubset = newSubsets[newSubsets.length - 1]

        const vertSubset = from.skinning.subsets[newSkinData[0]]
        //const vert = to.coreMesh.verts[newSkinData[2]]
        const skinning = newSkinData[1].clone()

        //add subset
        if (toSubsetToFromSubsetMap.get(currentSubset) !== vertSubset) {
            const toPush = vertSubset.clone()
            newSubsets.push(toPush)
            toSubsetToFromSubsetMap.set(toPush, vertSubset)
            toPush.vertsBegin = i
            toPush.vertsLength = 1
        } else {
            currentSubset.vertsLength += 1
        }

        //add vert and skinning
        newVerts.push(newSkinData[2])
        newSkinnings.push(skinning)
    }

    //update faces
    for (let i = 0; i < to.coreMesh.numfaces; i++) {
        const face = to.coreMesh.getFace(i)
    
        to.coreMesh.setFace(i, [
            newVerts.indexOf(face[0]),
            newVerts.indexOf(face[1]),
            newVerts.indexOf(face[2])
        ])
    }

    //actually update the new stuff
    to.coreMesh.onlyVerts(newVerts)

    to.skinning.subsets = []
    for (const subset of newSubsets) {
        to.skinning.subsets.push(subset.clone())
    }
    to.skinning.skinnings = newSkinnings

    //faces
    if (from.facs) {
        to.facs = from.facs.clone()
    }
}

export function inheritSkeleton(to: FileMesh, from: FileMesh) {
    if (from.skinning.skinnings.length < 1) {
        warn(false, `From mesh has no skeleton that can be inherited`)
        return
    }

    to.skinning = from.skinning.clone()
    to.skinning.numSkinnings = to.coreMesh.numverts
    to.skinning.skinnings = new Array(to.skinning.numSkinnings)

    const vertKD = buildVertKD(from)
    const newSkinDatas: [number, FileMeshSkinning, number][] = new Array(to.coreMesh.numverts)

    for (let i = 0; i < to.coreMesh.numverts; i++) {
        let normal = to.coreMesh.getNormal(i)
        if (isNaN(normal[0]) || isNaN(normal[1]) || isNaN(normal[2])) {
            normal = [0,0,0]
        }
        const toVertPos = to.coreMesh.getPos(i)
        const toSearch = minus(toVertPos, multiply(normal, [0,0,0]))
        const closest = nearestSearch(vertKD, toSearch)
        const closestI = closest.index

        const closestSkinning = from.skinning.skinnings[closestI]
        const closestSubsetIndex = from.skinning.getSubsetIndex(closestI)

        newSkinDatas[i] = [closestSubsetIndex, closestSkinning, i]
    }

    newSkinDatas.sort((a, b) => {return a[0] - b[0]})

    //update mesh to use new data
    const newSubsets: FileMeshSubset[] = []
    const newVerts: number[] = []
    const newSkinnings: FileMeshSkinning[] = []

    const toSubsetToFromSubsetMap = new Map<FileMeshSubset,FileMeshSubset>()

    for (let i = 0; i < newSkinDatas.length; i++) {
        const newSkinData = newSkinDatas[i]

        const currentSubset = newSubsets[newSubsets.length - 1]

        const vertSubset = from.skinning.subsets[newSkinData[0]]
        const toVertIndex = newSkinData[2]
        const skinning = newSkinData[1].clone()

        //add subset
        if (toSubsetToFromSubsetMap.get(currentSubset) !== vertSubset) {
            const toPush = vertSubset.clone()
            newSubsets.push(toPush)
            toSubsetToFromSubsetMap.set(toPush, vertSubset)
            toPush.vertsBegin = i
            toPush.vertsLength = 1
        } else {
            currentSubset.vertsLength += 1
        }

        //add vert and skinning
        newVerts.push(toVertIndex)
        newSkinnings.push(skinning)
    }

    //update faces
    for (let i = 0; i < to.coreMesh.numfaces; i++) {
        const face = to.coreMesh.getFace(i)
    
        to.coreMesh.setFace(i, [
            newVerts.indexOf(face[0]),
            newVerts.indexOf(face[1]),
            newVerts.indexOf(face[2])
        ])
    }

    //actually update the new stuff
    to.coreMesh.onlyVerts(newVerts)

    to.skinning.subsets = []
    for (const subset of newSubsets) {
        to.skinning.subsets.push(subset.clone())
    }
    to.skinning.skinnings = newSkinnings

    //faces
    if (from.facs) {
        to.facs = from.facs.clone()
    }
}

export function mergeTargetWithReference(reference: FileMesh, target: FileMesh, targetSize: Vector3, targetCFrame: CFrame, ignoredIndices: number[] = []): number[] {
    const referenceHashMap = getUVtoIndexMap(reference)
    
    const changedVerts = []

    for (let i = 0; i < target.coreMesh.numverts; i++) {
        if (ignoredIndices.includes(i)) continue

        //const vert = target.coreMesh.verts[i]
        const vertUV = target.coreMesh.getUV(i)
        const vertPos = target.coreMesh.getPos(i)
        const vertNormal = target.coreMesh.getNormal(i)
        
        const hash = hashVec2(vertUV[0], vertUV[1])
        
        const refVertIndex = referenceHashMap.get(hash)
        if (refVertIndex) {
            const offsetVec3 = targetCFrame.Position
            reference.coreMesh.setPos(refVertIndex, [vertPos[0] * targetSize.X + offsetVec3[0], vertPos[1] * targetSize.Y + offsetVec3[1], vertPos[2] * targetSize.Z + offsetVec3[2]])
            reference.coreMesh.setNormal(refVertIndex, [vertNormal[0], vertNormal[1], vertNormal[2]])

            changedVerts.push(refVertIndex)
        }
    }

    return changedVerts
}

export function deformReferenceToBaseBodyParts(reference: FileMesh, targetCages: FileMesh[], targetSizes: Vector3[], targetCFrames: CFrame[]): number[] {
    const changedVerts: number[] = []

    for (let i = 0; i < targetCages.length; i++) {
        const loadedMesh = targetCages[i]
        if (loadedMesh && targetSizes && targetCFrames) {
            const mergeChangedVerts = mergeTargetWithReference(reference, loadedMesh, targetSizes[i].divide(new Vector3().fromVec3(loadedMesh.size)), targetCFrames[i])
            for (const changedVert of mergeChangedVerts) {
                changedVerts.push(changedVert)
            }
        }
    }

    return changedVerts
}

export function offsetMesh(mesh: FileMesh, cframe: CFrame) {
    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        mesh.coreMesh.setPos(i, add(mesh.coreMesh.getPos(i), cframe.Position))
    }

    for (const bone of mesh.skinning.bones) {
        bone.position = add(bone.position, cframe.Position)
    }
}

export function scaleMesh(mesh: FileMesh, scale: Vector3) {
    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        mesh.coreMesh.setPos(i, new Vector3().fromVec3(mesh.coreMesh.getPos(i)).multiply(scale).toVec3())
    }

    for (const bone of mesh.skinning.bones) {
        bone.position = new Vector3().fromVec3(bone.position).multiply(scale).toVec3()
    }
}

export function offsetMeshWithRotation(mesh: FileMesh, cframe: CFrame) {
    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        const vertCF = new CFrame(...mesh.coreMesh.getPos(i))
        mesh.coreMesh.setPos(i, cframe.multiply(vertCF).Position)
    }

    for (const bone of mesh.skinning.bones) {
        const boneCF = new CFrame(...bone.position)
        bone.position = cframe.multiply(boneCF).Position
    }
}

export function getOffsetArray(inner: FileMesh, outer: FileMesh) {
    const offsetArray: ([Vec3, THREE.Quaternion, number] | undefined)[] = new Array(inner.coreMesh.numverts)
    const outerVertHashMap = getUVtoIndexMap(outer)
    for (let i = 0; i < inner.coreMesh.numverts; i++) {
        const vertUV = inner.coreMesh.getUV(i)
        const vertPos = inner.coreMesh.getPos(i)
        const vertNormal = inner.coreMesh.getNormal(i)

        const vertHash = hashVec2(vertUV[0], vertUV[1])
        const outerVert = outerVertHashMap.get(vertHash)

        if (outerVert !== undefined) {
            const outerVertPos = outer.coreMesh.getPos(outerVert)
            const outerVertNormal = outer.coreMesh.getNormal(outerVert)

            const offset = minus(outerVertPos, vertPos)
            const innerNormal = new THREE.Vector3(vertNormal[0], vertNormal[1], vertNormal[2])
            const outerNormal = new THREE.Vector3(outerVertNormal[0], outerVertNormal[1], outerVertNormal[2])

            const quat = new THREE.Quaternion().setFromUnitVectors(innerNormal, outerNormal)

            offsetArray[i] = [offset, quat, outerNormal.length() / innerNormal.length()]
        } else {
            offsetArray[i] = undefined
        }
    }

    return offsetArray
}

export function getDistIndexArray(ref: FileMesh, dist: FileMesh) {
    const offsetArray: (number | undefined)[] = new Array(ref.coreMesh.numverts)
    const outerVertHashMap = getUVtoIndexMap(dist)
    for (let i = 0; i < ref.coreMesh.numverts; i++) {
        const vertUV = ref.coreMesh.getUV(i)
        const vertHash = hashVec2(vertUV[0], vertUV[1])
        const outerVert = outerVertHashMap.get(vertHash)
        offsetArray[i] = outerVert
    }

    return offsetArray
}

export type MeshChunk = {
    pos: Vec3,
    indices: number[],
}

export type WeightChunk = {
    meshChunk: MeshChunk,
    weights: number[]
}

export type WeightChunk3 = WeightChunk & {
    weights: Vec3[]
}

function toChunkPos(v0: Vec3, size: Vec3, widthSplit: number, heightSplit: number, depthSplit: number, lowerBound: Vec3, higherBound: Vec3): Vec3 {
    const offsetV0 = add(v0, multiply(size, [0.5, 0.5, 0.5]))
    //console.log(offsetV0)
    const normalizedV0 = divide(offsetV0, size)
    //console.log(normalizedV0)
    const sizedV0 = multiply(normalizedV0, [widthSplit, heightSplit, depthSplit])
    //console.log(sizedV0)
    const clampedV0 = clamp(sizedV0, lowerBound, higherBound)
    //console.log(clampedV0)
    return clampedV0
}

export function vertPosToChunkPos(pos: Vec3, meshSize: Vec3, widthSplit: number, heightSplit: number, depthSplit: number) {
    const lowerBound: Vec3 = [0,0,0]
    const higherBound: Vec3 = [widthSplit - 1, heightSplit - 1, depthSplit - 1]
    const chunkPos = clamp(floor(multiply(divide(add(pos, multiply(meshSize,[0.5,0.5,0.5])), meshSize), [widthSplit, heightSplit, depthSplit])), lowerBound, higherBound)

    return chunkPos
}

export function createWeightsForMeshChunked(mesh: FileMesh, ref_mesh: FileMesh) {
    const sigma = ref_mesh.size[2] / 0.838 * 0.04
    
    //create base chunks
    const heightRatio = Math.min(Math.max(ref_mesh.size[1] / ref_mesh.size[0],0.5),2)

    const widthSplit = mesh.coreMesh.numverts < 1500 ? 8 : 12
    const heightSplit = Math.floor(widthSplit * heightRatio)
    const depthSplit = 1

    const lowerBound: Vec3 = [0,0,0]
    const higherBound: Vec3 = [widthSplit - 1, heightSplit - 1, depthSplit - 1]

    const baseChunks: MeshChunk[] = new Array(widthSplit * heightSplit * depthSplit)
    let i = 0;
    for (let x = 0; x < widthSplit; x++) {
        for (let y = 0; y < heightSplit; y++) {
            for (let z = 0; z < depthSplit; z++) {
                const baseChunk: MeshChunk = {
                    pos: [x,y,z],
                    indices: [],
                }

                baseChunks[i] = baseChunk
                i++
            }
        }
    }

    let [meshLowerBound, meshHigherBound] = mesh.bounds
    meshLowerBound = toChunkPos(meshLowerBound, mesh.size, widthSplit, heightSplit, depthSplit, lowerBound, higherBound)
    meshHigherBound = toChunkPos(meshHigherBound, mesh.size, widthSplit, heightSplit, depthSplit, lowerBound, higherBound)

    /*meshLowerBound[0] -= 1
    meshLowerBound[1] -= 1
    meshLowerBound[2] -= 1
    meshHigherBound[0] += 1
    meshHigherBound[1] += 1
    meshHigherBound[2] += 1*/

    const usedBaseChunks: MeshChunk[] = []
    for (let i = 0; i < baseChunks.length; i++) {
        const baseChunk = baseChunks[i]
        if (baseChunk.pos[0] >= meshLowerBound[0] && baseChunk.pos[1] >= meshLowerBound[1] && baseChunk.pos[2] >= meshLowerBound[2] &&
            baseChunk.pos[0] <= meshHigherBound[0] && baseChunk.pos[1] <= meshHigherBound[1] && baseChunk.pos[2] <= meshHigherBound[2]
        ) {
            usedBaseChunks.push(baseChunk)
        }
    }
    
    /*
    const vert = ref_mesh.coreMesh.verts[2]
    const chunkPos = clamp(floor(multiply(divide(add(vert.position, multiply(ref_mesh.size,[0.5,0.5,0.5])), ref_mesh.size), [widthSplit, heightSplit, depthSplit])), lowerBound, higherBound)    

    console.log(vert.position, ref_mesh.size)
    console.log(chunkPos)
    console.log("---")
    console.log(toChunkPos(vert.position, ref_mesh.size, widthSplit, heightSplit, depthSplit, lowerBound, higherBound))
    */

    for (let i = 0; i < ref_mesh.coreMesh.numverts; i++) {
        const vertPos = ref_mesh.coreMesh.getPos(i)
        const chunkPos = clamp(minus(multiply(divide(add(vertPos, multiply(ref_mesh.size,[0.5,0.5,0.5])), ref_mesh.size), [widthSplit, heightSplit, depthSplit]), [0.5,0.5,0.5]), lowerBound, higherBound)
        /*const chunkPos: Vec3 = clamp([
            mapNum(vert.position[0], mesh.bounds[0][0], mesh.bounds[1][0], lowerBound[0], higherBound[0]) + 0.5,
            mapNum(vert.position[1], mesh.bounds[0][1], mesh.bounds[1][1], lowerBound[1], higherBound[1]) + 0.5,
            mapNum(vert.position[2], mesh.bounds[0][2], mesh.bounds[1][2], lowerBound[2], higherBound[2]) + 0.5,
        ],lowerBound,higherBound)
        */

        for (let j = 0; j < usedBaseChunks.length; j++) {
            const baseChunk = usedBaseChunks[j]
            if (distance(baseChunk.pos, chunkPos) <= Math.sqrt(3)) {
                baseChunk.indices.push(i)
            }
        }
    }

    //make sure every chunk has at least some indices by making ones without any indices setting refererences to the closest ones with
    const chunkToCloseChunk = new Map<MeshChunk,MeshChunk>()

    for (const baseChunk of usedBaseChunks) {
        if (baseChunk.indices.length < 10) {
            let closestChunk = undefined
            let lastDistance = 99999

            for (const baseChunk2 of usedBaseChunks) {
                const dist = distance(baseChunk2.pos, baseChunk.pos)
                if (dist < lastDistance && baseChunk2.indices.length > 10) {
                    lastDistance = dist
                    closestChunk = baseChunk2
                }
            }

            if (closestChunk) {
                chunkToCloseChunk.set(baseChunk, closestChunk)
            }
        }
    }

    for (const baseChunk of usedBaseChunks) {
        const closeChunk = chunkToCloseChunk.get(baseChunk)
        if (closeChunk) {
            baseChunk.indices = closeChunk.indices
        }
    }


    //calculate weights
    const weightChunks: WeightChunk[] = new Array(mesh.coreMesh.numverts)

    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        const vertPos = mesh.coreMesh.getPos(i)
        const chunkPos = clamp(floor(multiply(divide(add(vertPos, multiply(ref_mesh.size,[0.5,0.5,0.5])), ref_mesh.size), [widthSplit, heightSplit, depthSplit])), lowerBound, higherBound)
        /*const chunkPos: Vec3 = floor(clamp([
            mapNum(vert.position[0], mesh.bounds[0][0], mesh.bounds[1][0], lowerBound[0], higherBound[0]),
            mapNum(vert.position[1], mesh.bounds[0][1], mesh.bounds[1][1], lowerBound[1], higherBound[1]),
            mapNum(vert.position[2], mesh.bounds[0][2], mesh.bounds[1][2], lowerBound[2], higherBound[2]),
        ],lowerBound,higherBound))*/
        const [x,y,z] = chunkPos

        const baseChunk = baseChunks[x * (heightSplit * depthSplit) + y * depthSplit + z]
        const weights = new Array(baseChunk.indices.length)
        let weightSum = 0

        for (let i = 0; i < baseChunk.indices.length; i++) {
            const index = baseChunk.indices[i]
            const indexVertPos = ref_mesh.coreMesh.getPos(index)
            const weight = gaussian_rbf(vertPos, indexVertPos, sigma)
            weightSum += weight
            weights[i] = weight
        }

        if (weightSum !== 0) {
            for (let i = 0; i < weights.length; i++) {
                weights[i] /= weightSum
            }
        }/* else {
            if (i === 0) {
                console.log("b")
                console.log(vert.position)
                console.log(clamp((multiply(divide(add(vert.position, multiply(ref_mesh.size,[0.5,0.5,0.5])), ref_mesh.size), [widthSplit, heightSplit, depthSplit])), lowerBound, higherBound))
                console.log(i, baseChunk, chunkPos)
            }
        }*/

        const weightChunk = {
            meshChunk: baseChunk,
            weights: weights,
        }

        weightChunks[i] = weightChunk
    }

    return weightChunks
}

//TODO: discover new algorithm that works better
export function layerClothingChunked(mesh: FileMesh, ref_mesh: FileMesh, dist_mesh: FileMesh, cacheId?: string) {
    console.time("total")

    //TODO: actually get a better algorithm instead of cheating like this, (dist_mesh is inflated to avoid clipping)
    //console.time("inflation")
    
    //for (let i = 0; i < ref_mesh.coreMesh.verts.length; i++) {
    //    const ref_vert = ref_mesh.coreMesh.verts[i]
    //    const dist_vert = dist_mesh.coreMesh.verts[i]
    //
    //    const xSim = mapNum(ref_vert.normal[0] * dist_vert.normal[0], -1, 1, 1, 0)
    //    const ySim = mapNum(ref_vert.normal[1] * dist_vert.normal[1], -1, 1, 1, 0)
    //    const zSim = mapNum(ref_vert.normal[2] * dist_vert.normal[2], -1, 1, 1, 0)
    //
    //    dist_vert.position = add(dist_vert.position, multiply(dist_vert.normal, [0.05, 0.05, 0.05]))
    //    dist_vert.position = add(dist_vert.position, multiply(dist_vert.normal, [0.5 * xSim,0.5 * ySim,0.5 * zSim]))
    //}
    

    if (FLAGS.INFLATE_LAYERED_CLOTHING) {
        for (let i = 0; i < dist_mesh.coreMesh.numverts; i++) {
            const vertPos = dist_mesh.coreMesh.getPos(i)
            const vertNormal = dist_mesh.coreMesh.getNormal(i)

            dist_mesh.coreMesh.setPos(i, add(vertPos, multiply(vertNormal, [FLAGS.INFLATE_LAYERED_CLOTHING,FLAGS.INFLATE_LAYERED_CLOTHING,FLAGS.INFLATE_LAYERED_CLOTHING])))
        }
    }
    //console.timeEnd("inflation")

    //console.time("offsetArray")
    const offsetArray = getOffsetArray(ref_mesh, dist_mesh)
    //console.timeEnd("offsetArray")
    //console.time("weights")
    let allWeights = undefined
    if (cacheId && FLAGS.ENABLE_LC_WEIGHT_CACHE) {
        allWeights = WeightCache.get(cacheId)
    }
    if (!allWeights) {
        allWeights = createWeightsForMeshChunked(mesh, ref_mesh)
        if (cacheId && FLAGS.ENABLE_LC_WEIGHT_CACHE) {
            WeightCache.set(cacheId, allWeights)
        }
    }
    //console.timeEnd("weights")

    //console.time("offset")


    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        //const vert = mesh.coreMesh.verts[i]
        const vertPos = mesh.coreMesh.getPos(i)

        let totalOffset: Vec3 = [0,0,0]
        
        const weights = allWeights[i]

        for (let j = 0; j < weights.meshChunk.indices.length; j++) {
            const weight = weights.weights[j]
            const index = weights.meshChunk.indices[j]

            const offsetInfo = offsetArray[index]
            if (offsetInfo) {
                const [offset] = offsetInfo
                totalOffset = add(totalOffset, multiply(offset, [weight,weight,weight]))
            }
        }

        mesh.coreMesh.setPos(i, add(vertPos, totalOffset))
    }
    //console.timeEnd("offset")

    console.timeEnd("total")
}

//Experimental algorithm that uses normals (it didnt work well, im not sure why) WRITTEN WAY LATER: actually this algorithm is way better at preserving shape BUT buggy (sections may be missing)
//Maybe the solution is to describe the coordinates of each mesh_vert with (the rotated normal of a refmesh_vert + position of a refmesh_vert), kinda like baycentric coordinates
export function layerClothingChunkedNormals(mesh: FileMesh, ref_mesh: FileMesh, dist_mesh: FileMesh, cacheId?: string) {
    console.time("total")

    //console.time("normals")
    //ref_mesh.recalculateNormals()
    //dist_mesh.recalculateNormals()
    //console.timeEnd("normals")

    console.time("offsetArray")
    const offsetArray = getOffsetArray(ref_mesh, dist_mesh)
    console.timeEnd("offsetArray")
    console.time("weights")
    let allWeights = undefined
    if (cacheId && FLAGS.ENABLE_LC_WEIGHT_CACHE) {
        allWeights = WeightCache.get(cacheId)
    }
    if (!allWeights) {
        allWeights = createWeightsForMeshChunked(mesh, ref_mesh)
        if (cacheId && FLAGS.ENABLE_LC_WEIGHT_CACHE) {
            WeightCache.set(cacheId, allWeights)
        }
    }
    console.timeEnd("weights")

    console.time("offset")

    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        //const vert = mesh.coreMesh.verts[i]
        let vertPos = mesh.coreMesh.getPos(i)

        let originalPosition: Vec3 = [0,0,0]
        let totalOffset: Vec3 = [0,0,0]
        let totalNormalOffset: Vec3 = [0,0,0]
        
        const weights = allWeights[i]

        for (let j = 0; j < weights.meshChunk.indices.length; j++) {
            const weight = weights.weights[j]
            const index = weights.meshChunk.indices[j]
            
            const offsetInfo = offsetArray[index]
            if (offsetInfo) {
                const [offset, quat] = offsetInfo

                const refVertPos = ref_mesh.coreMesh.getPos(index)

                //innercage -> outercage offset
                originalPosition = add(originalPosition, multiply(add(refVertPos,offset), [weight,weight,weight]))
                totalOffset = add(totalOffset, multiply(offset, [weight,weight,weight]))

                //innercage -> mesh offset (rotated)
                const toRotateOffset = minus(vertPos, refVertPos)
                const rotatedOffsetTHREE = new THREE.Vector3(toRotateOffset[0], toRotateOffset[1], toRotateOffset[2]).applyQuaternion(quat)
                const rotatedOffset: Vec3 = [rotatedOffsetTHREE.x, rotatedOffsetTHREE.y, rotatedOffsetTHREE.z]
                totalNormalOffset = add(totalNormalOffset, multiply(rotatedOffset, [weight, weight, weight]))
            }
        }

        mesh.coreMesh.setPos(i, originalPosition)
        vertPos = mesh.coreMesh.getPos(i)
        //vert.position = add(vert.position, totalOffset)
        mesh.coreMesh.setPos(i, add(vertPos, totalNormalOffset))
    }
    console.timeEnd("offset")

    console.timeEnd("total")
}

export function layerClothingChunkedNormals2(mesh: FileMesh, ref_mesh: FileMesh, dist_mesh: FileMesh, cacheId?: string) {
    console.time("total")

    //TODO: actually get a better algorithm instead of cheating like this, (dist_mesh is inflated to avoid clipping)
    //console.time("inflation")
    
    //for (let i = 0; i < ref_mesh.coreMesh.verts.length; i++) {
    //    const ref_vert = ref_mesh.coreMesh.verts[i]
    //    const dist_vert = dist_mesh.coreMesh.verts[i]
    //
    //    const xSim = mapNum(ref_vert.normal[0] * dist_vert.normal[0], -1, 1, 1, 0)
    //    const ySim = mapNum(ref_vert.normal[1] * dist_vert.normal[1], -1, 1, 1, 0)
    //    const zSim = mapNum(ref_vert.normal[2] * dist_vert.normal[2], -1, 1, 1, 0)
    //
    //    dist_vert.position = add(dist_vert.position, multiply(dist_vert.normal, [0.05, 0.05, 0.05]))
    //    dist_vert.position = add(dist_vert.position, multiply(dist_vert.normal, [0.5 * xSim,0.5 * ySim,0.5 * zSim]))
    //}
    

    if (FLAGS.INFLATE_LAYERED_CLOTHING) {
        for (let i = 0; i < dist_mesh.coreMesh.numverts; i++) {
            const vertPos = dist_mesh.coreMesh.getPos(i)
            const vertNormal = dist_mesh.coreMesh.getNormal(i)

            dist_mesh.coreMesh.setPos(i, add(vertPos, multiply(vertNormal, [FLAGS.INFLATE_LAYERED_CLOTHING,FLAGS.INFLATE_LAYERED_CLOTHING,FLAGS.INFLATE_LAYERED_CLOTHING])))
        }
    }
    //console.timeEnd("inflation")

    //console.time("offsetArray")
    const distVertsFromRefVerts = getDistIndexArray(ref_mesh, dist_mesh)
    //console.timeEnd("offsetArray")

    //console.time("weights")
    let allWeights = undefined
    if (cacheId && FLAGS.ENABLE_LC_WEIGHT_CACHE) {
        allWeights = WeightCache.get(cacheId)
    }
    if (!allWeights) {
        allWeights = createWeightsForMeshChunked(mesh, ref_mesh)
        if (cacheId && FLAGS.ENABLE_LC_WEIGHT_CACHE) {
            WeightCache.set(cacheId, allWeights)
        }
    }
    //console.timeEnd("weights")

    //console.time("offset")

    for (let i = 0; i < mesh.coreMesh.numverts; i++) {
        //const vert = mesh.coreMesh.verts[i]
        const vertPos = mesh.coreMesh.getPos(i)

        let totalOffset: Vec3 = [0,0,0]
        
        const weights = allWeights[i]

        for (let j = 0; j < weights.meshChunk.indices.length; j++) {
            const weight = weights.weights[j]
            const index = weights.meshChunk.indices[j]

            //const refVert = ref_mesh.coreMesh.verts[index]
            const distVertIndex = distVertsFromRefVerts[index]

            const refVertPos = ref_mesh.coreMesh.getPos(index)
            const refVertNormal = ref_mesh.coreMesh.getNormal(index)

            if (distVertIndex !== undefined) {
                const distVertNormal = dist_mesh.coreMesh.getNormal(distVertIndex)
                const distVertPos = dist_mesh.coreMesh.getPos(distVertIndex)

                const refNormal = new THREE.Vector3(refVertNormal[0], refVertNormal[1], refVertNormal[2])
                const distNormal = new THREE.Vector3(distVertNormal[0], distVertNormal[1], distVertNormal[2])

                const quat = new THREE.Quaternion().setFromUnitVectors(refNormal, distNormal)

                const ogOffset = minus(vertPos, refVertPos)
                const newOffset = new THREE.Vector3(...ogOffset).applyQuaternion(quat)

                totalOffset = add(totalOffset, multiply(add(distVertPos, newOffset.toArray()), [weight,weight,weight]))
            }
        }

        mesh.coreMesh.setPos(i, totalOffset)
    }
    //console.timeEnd("offset")

    console.timeEnd("total")
}