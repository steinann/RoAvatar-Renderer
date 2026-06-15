//https://devforum.roblox.com/t/roblox-filemesh-format-specification/326114

import SimpleView from "../lib/simple-view"
import { clonePrimitiveArray } from "../misc/misc"
import { hashVec2, hashVec3, hashVec3Safe } from "./mesh-deform"
import { CFrame, Vector3 } from "../rblx/rbx"
import type { Bounds } from "../misc/collision";
import { log, warn } from "../misc/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const DracoDecoderModule: any;

if (!DracoDecoderModule) {
    throw new Error("Missing module dependency: draco_decoder.js")
}

/** @category Mesh */
export type Vec4 = [number,number,number,number]
/** @category Mesh */
export type Vec3 = [number,number,number]
/** @category Mesh */
export type Vec2 = [number,number]

/** @category Mesh */
export type Triangle = [Vec3, Vec3, Vec3]

/** @category Mesh */
export type Mat3x3 = [number,number,number,number,number,number,number,number,number]
/** @category Mesh */
export type Mat4x4 = [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number]

type LodType = "None" | "Unknown" | "RbxSimplifier" | "ZeuxMeshOptimizer"
const LodType: {[K in LodType]: number} = {
    "None": 0,
    "Unknown": 1,
    "RbxSimplifier": 2,
    "ZeuxMeshOptimizer": 3,
}

/**
 * Class inside FileMesh that contains core data
 * @category Mesh */
export class COREMESH {
    private _numverts: number = 0 //uint

    private _positions: Float32Array = new Float32Array()
    private _normals: Float32Array = new Float32Array()
    private _uvs: Float32Array = new Float32Array()
    private _tangents: Int8Array = new Int8Array()
    private _colors: Uint8Array = new Uint8Array()

    private _numfaces: number = 0 //uint
    private _indices: Uint16Array = new Uint16Array()

    get numverts(): number {
        return this._numverts
    }

    get numfaces(): number {
        return this._numfaces
    }

    set numverts(value: number) {
        this._numverts = value

        this._positions = new Float32Array(value * 3)
        this._normals = new Float32Array(value * 3)
        this._uvs = new Float32Array(value * 2)
        this._tangents = new Int8Array(value * 4)
        this._colors = new Uint8Array(value * 4).fill(255)
    }

    set numfaces(value: number) {
        this._numfaces = value
        this._indices = new Uint16Array(value * 3)
    }

    clone() {
        const copy = new COREMESH()
        copy._numverts = this._numverts

        copy._positions = this._positions.slice()
        copy._normals = this._normals.slice()
        copy._uvs = this._uvs.slice()
        copy._tangents = this._tangents.slice()
        copy._colors = this._colors.slice()

        copy._numfaces = this._numfaces
        copy._indices = this._indices.slice()

        return copy
    }

    getPos(i: number): Vec3 {
        return [
            this._positions[3*i + 0],
            this._positions[3*i + 1],
            this._positions[3*i + 2]
        ]
    }

    setPos(i: number, value: Vec3): void {
        this._positions[3*i + 0] = value[0]
        this._positions[3*i + 1] = value[1]
        this._positions[3*i + 2] = value[2]
    }

    getNormal(i: number): Vec3 {
        return [
            this._normals[3*i + 0],
            this._normals[3*i + 1],
            this._normals[3*i + 2]
        ]
    }

    setNormal(i: number, value: Vec3): void {
        this._normals[3*i + 0] = value[0]
        this._normals[3*i + 1] = value[1]
        this._normals[3*i + 2] = value[2]
    }

    getUV(i: number): Vec2 {
        return [
            this._uvs[2*i + 0],
            this._uvs[2*i + 1]
        ]
    }

    setUV(i: number, value: Vec2): void {
        this._uvs[2*i + 0] = value[0]
        this._uvs[2*i + 1] = value[1]
    }

    getTangent(i: number): Vec4 {
        return [
            this._tangents[4*i + 0],
            this._tangents[4*i + 1],
            this._tangents[4*i + 2],
            this._tangents[4*i + 3]
        ]
    }

    setTangent(i: number, value: Vec4): void {
        this._tangents[4*i + 0] = value[0]
        this._tangents[4*i + 1] = value[1]
        this._tangents[4*i + 2] = value[2]
        this._tangents[4*i + 3] = value[3]
    }

    getColor(i: number): Vec4 {
        return [
            this._colors[4*i + 0],
            this._colors[4*i + 1],
            this._colors[4*i + 2],
            this._colors[4*i + 3]
        ]
    }

    setColor(i: number, value: Vec4): void {
        this._colors[4*i + 0] = value[0]
        this._colors[4*i + 1] = value[1]
        this._colors[4*i + 2] = value[2]
        this._colors[4*i + 3] = value[3]
    }

    getFace(i: number): Vec3 {
        return [
            this._indices[i*3 + 0],
            this._indices[i*3 + 1],
            this._indices[i*3 + 2]
        ]
    }

    setFace(i: number, value: Vec3): void {
        this._indices[3*i + 0] = value[0]
        this._indices[3*i + 1] = value[1]
        this._indices[3*i + 2] = value[2]
    }

    getTriangle(index: number): Triangle {
        const face = this.getFace(index)


        return [this.getPos(face[0]), this.getPos(face[1]), this.getPos(face[2])]
    }

    readVert(i: number, view: SimpleView, sizeOf_vert = 40) {
        const position: Vec3 = [view.readFloat32(), view.readFloat32(), view.readFloat32()]
        if (isNaN(position[0])) position[0] = 0
        if (isNaN(position[1])) position[1] = 0
        if (isNaN(position[2])) position[2] = 0
        this.setPos(i, position)

        const normal: Vec3 = [view.readFloat32(), view.readFloat32(), view.readFloat32()]
        if (isNaN(normal[0])) normal[0] = 0
        if (isNaN(normal[1])) normal[1] = 0
        if (isNaN(normal[2])) normal[2] = 0
        this.setNormal(i, normal)

        const uv: Vec2 = [view.readFloat32(), view.readFloat32()]
        if (isNaN(uv[0])) uv[0] = 0
        if (isNaN(uv[1])) uv[1] = 0
        this.setUV(i, uv)

        const tangent: Vec4 = [view.readInt8(), view.readInt8(), view.readInt8(), view.readInt8()]
        if (isNaN(tangent[0])) tangent[0] = 0
        if (isNaN(tangent[1])) tangent[1] = 0
        if (isNaN(tangent[2])) tangent[2] = 0
        if (isNaN(tangent[3])) tangent[3] = 0
        this.setTangent(i, tangent)

        let color: Vec4 = [255,255,255,255]
        if (sizeOf_vert == 40) {
            color = [view.readUint8(),view.readUint8(),view.readUint8(),view.readUint8()]
            if (isNaN(color[0])) color[0] = 0
            if (isNaN(color[1])) color[1] = 0
            if (isNaN(color[2])) color[2] = 0
            if (isNaN(color[3])) color[3] = 0
        }
        this.setColor(i, color)
    }

    readFace(i: number, view: SimpleView) {
        const a = view.readUint32()
        const b = view.readUint32()
        const c = view.readUint32()

        this.setFace(i, [a,b,c])
    }

    sliceVerts(begin: number = 0, end: number = this.numverts) {
        const newSize = end - begin

        const ogPositions = this._positions
        const ogNormals = this._normals
        const ogUVs = this._uvs
        const ogTangents = this._tangents
        const ogColors = this._colors

        this.numverts = newSize

        this._positions.set(ogPositions.subarray(begin * 3, end * 3), 0)
        this._normals.set(ogNormals.subarray(begin * 3, end * 3), 0)
        this._uvs.set(ogUVs.subarray(begin * 2, end * 2), 0)
        this._tangents.set(ogTangents.subarray(begin * 4, end * 4), 0)
        this._colors.set(ogColors.subarray(begin * 4, end * 4), 0)
    }

    sliceFaces(begin: number = 0, end: number = this.numfaces) {
        const newSize = end - begin

        const ogIndices = this._indices

        this.numfaces = newSize

        this._indices.set(ogIndices.subarray(begin * 3, end * 3), 0)
    }

    increaseVerts(add: number) {
        const newSize = this.numverts + add

        const ogPositions = this._positions
        const ogNormals = this._normals
        const ogUVs = this._uvs
        const ogTangents = this._tangents
        const ogColors = this._colors

        this.numverts = newSize

        this._positions.set(ogPositions)
        this._normals.set(ogNormals)
        this._uvs.set(ogUVs)
        this._tangents.set(ogTangents)
        this._colors.set(ogColors)
    }

    increaseFaces(add: number) {
        const newSize = this.numfaces + add

        const ogIndices = this._indices

        this.numfaces = newSize

        this._indices.set(ogIndices)
    }

    onlyVerts(only: number[]) {
        const newSize = only.length

        const ogPositions = this._positions
        const ogNormals = this._normals
        const ogUVs = this._uvs
        const ogTangents = this._tangents
        const ogColors = this._colors

        this.numverts = newSize

        for (let i = 0; i < only.length; i++) {
            const j = only[i]

            const ogPos: Vec3 = [
                ogPositions[j*3 + 0],
                ogPositions[j*3 + 1],
                ogPositions[j*3 + 2],
            ]

            const ogNormal: Vec3 = [
                ogNormals[j*3 + 0],
                ogNormals[j*3 + 1],
                ogNormals[j*3 + 2],
            ]

            const ogUV: Vec2 = [
                ogUVs[j*2 + 0],
                ogUVs[j*2 + 1]
            ]

            const ogTangent: Vec4 = [
                ogTangents[j*4 + 0],
                ogTangents[j*4 + 1],
                ogTangents[j*4 + 2],
                ogTangents[j*4 + 3],
            ]

            const ogColor: Vec4 = [
                ogColors[j*4 + 0],
                ogColors[j*4 + 1],
                ogColors[j*4 + 2],
                ogColors[j*4 + 3],
            ]

            this.setPos(i, ogPos)
            this.setNormal(i, ogNormal)
            this.setUV(i, ogUV)
            this.setTangent(i, ogTangent)
            this.setColor(i, ogColor)
        }
    }

    onlyFaces(only: number[]) {
        const newSize = only.length

        const ogIndices = this._indices

        this.numfaces = newSize

        for (let i = 0; i < only.length; i++) {
            const j = only[i]
            this.setFace(i, [
                ogIndices[j*3 + 0],
                ogIndices[j*3 + 1],
                ogIndices[j*3 + 2]
            ])
        }
    }

    getPositions(): Float32Array {
        return this._positions
    }

    getNormals(): Float32Array {
        return this._normals
    }

    getUVs(): Float32Array {
        return this._uvs
    }

    getTangents(): Int8Array {
        return this._tangents
    }

    getColors(): Uint8Array {
        return this._colors
    }

    getIndices(): Uint16Array {
        return this._indices
    }

    getTouchingVerts(index: number) {
        const touchingVerts: number[] = []

        for (let i = 0; i < this._numfaces; i++) {
            const face = this.getFace(i)

            if (face[0] === index || face[1] === index || face[2] === index) {
                if (face[0] !== index && !touchingVerts.includes(face[0])) {
                    touchingVerts.push(face[0])
                }
                if (face[1] !== index && !touchingVerts.includes(face[1])) {
                    touchingVerts.push(face[1])
                }
                if (face[2] !== index && !touchingVerts.includes(face[2])) {
                    touchingVerts.push(face[2])
                }
            }
        }

        return touchingVerts
    }

    getEdgeId(v0: number, v1: number) {
        const [x0, y0, z0] = this.getPos(v0)
        const [x1, y1, z1] = this.getPos(v1)

        const v0h = hashVec3Safe(Math.round(x0 * 1000), Math.round(y0 * 1000), Math.round(z0 * 1000))
        const v1h = hashVec3Safe(Math.round(x1 * 1000), Math.round(y1 * 1000), Math.round(z1 * 1000))

        const tv0 = v0h < v1h ? v0h : v1h
        const tv1 = v0h > v1h ? v0h : v1h

        return tv1 * 10000000n + tv0
    }

    getFaceEdges(i: number): [bigint,bigint,bigint] {
        const face = this.getFace(i)
        
        const edge0 = this.getEdgeId(face[0], face[1])
        const edge1 = this.getEdgeId(face[1], face[2])
        const edge2 = this.getEdgeId(face[2], face[0])

        return [edge0, edge1, edge2]
    }

    getEdgeCounts() {
        const edgeCountMap = new Map<bigint,number>()

        for (let i = 0; i < this.numfaces; i++) {
            const edges = this.getFaceEdges(i)
            for (const edge of edges) {
                if (!edgeCountMap.has(edge)) {
                    edgeCountMap.set(edge, 1)
                } else {
                    edgeCountMap.set(edge, edgeCountMap.get(edge)! + 1)
                }
            }
        }

        return edgeCountMap
    }
}

/**
 * Class inside FileMesh that contains LOD metadata
 * @category Mesh */
export class LODS {
    lodType: number = LodType.Unknown //ushort, 0 = None, 1 = Unknown, 2 = RbxSimplifier, 3 = ZeuxMeshOptimizer
    numHighQualityLODs: number = 0 //byte

    numLodOffsets: number = 0 //uint
    lodOffsets: number[] = [] //uint

    clone() {
        const copy = new LODS()
        copy.lodType = this.lodType
        copy.numHighQualityLODs = this.numHighQualityLODs
        copy.numLodOffsets = this.numLodOffsets
        copy.lodOffsets = clonePrimitiveArray(this.lodOffsets)

        return copy
    }
}

/**
 * Class inside FileMesh that contains HSR Always Visible data (unused?)
 * @category Mesh */
export class HSRAVIS {
    bitFlags: boolean[] = []

    clone() {
        const copy = new HSRAVIS()
        copy.bitFlags = new Array(this.bitFlags.length)
        for (let i = 0; i < this.bitFlags.length; i++) {
            copy.bitFlags[i] = this.bitFlags[i]
        }

        return copy
    }
}

/** 
 * Bone inside SKINNING in FileMesh
 * @category Mesh */
export class FileMeshBone {
    name?: string
    boneNameIndex: number = 0 //uint

    parentIndex: number = 0 //ushort
    lodParentIndex: number = 0 //ushort

    culling: number = 0 //float

    rotationMatrix: Mat3x3 = [1,0,0, 0,1,0, 0,0,1] //3x3, world space, y up, -z forward

    position: Vec3 = [0,0,0]

    //metadata so skeletondesc knows what autoskin has done
    sourcePart?: string
    sourceOffset: CFrame = new CFrame()
    sourceSize?: Vec3
    sourceScaled: Vec3 = [1,1,1]

    clone() {
        const copy = new FileMeshBone()
        copy.name = this.name
        copy.boneNameIndex = this.boneNameIndex
        copy.parentIndex = this.parentIndex
        copy.lodParentIndex = this.lodParentIndex
        copy.culling = this.culling
        copy.rotationMatrix = clonePrimitiveArray(this.rotationMatrix) as Mat3x3
        copy.position = clonePrimitiveArray(this.position) as Vec3
        copy.sourcePart = this.sourcePart
        copy.sourceOffset = this.sourceOffset.clone()
        if (this.sourceSize) copy.sourceSize = clonePrimitiveArray(this.sourceSize) as Vec3
        copy.sourceScaled = clonePrimitiveArray(this.sourceScaled) as Vec3

        return copy
    }
}

/**
 * Section of mesh inside SKINNING in FileMesh
 * @category Mesh */
export class FileMeshSubset {
    facesBegin: number = 0 //uint
    facesLength: number = 0 //uint

    vertsBegin: number = 0 //uint
    vertsLength: number = 0 //uint

    numBoneIndices: number = 0 //uint
    boneIndices: number[] = [] //ushort[26]

    clone() {
        const copy = new FileMeshSubset()
        copy.facesBegin = this.facesBegin
        copy.facesLength = this.facesLength
        copy.vertsBegin = this.vertsBegin
        copy.vertsLength = this.vertsLength
        copy.numBoneIndices = this.numBoneIndices
        copy.boneIndices = clonePrimitiveArray(this.boneIndices)

        return copy
    }
}

export class SKINNING {
    _numskinnings: number = 0

    private _indices: Uint16Array = new Uint16Array()
    private _weights: Float32Array = new Float32Array()

    bones: FileMeshBone[] = []

    clone(): SKINNING {
        const copy = new SKINNING()
        copy._numskinnings = this._numskinnings
        
        copy._indices = this._indices.slice()
        copy._weights = this._weights.slice()

        copy.bones = new Array(this.bones.length)
        for (let i = 0; i < this.bones.length; i++) {
            copy.bones[i] = this.bones[i].clone()
        }

        return copy
    }

    get numskinnings(): number {
        return this._numskinnings
    }

    set numskinnings(value: number) {
        this._numskinnings = value

        this._indices = new Uint16Array(value * 4)
        this._weights = new Float32Array(value * 4)
    }

    get indices() {
        return this._indices
    }

    get weights() {
        return this._weights
    }

    getIndex(i: number): Vec4 {
        return [
            this._indices[i*4 + 0],
            this._indices[i*4 + 1],
            this._indices[i*4 + 2],
            this._indices[i*4 + 3],
        ]
    }

    setIndex(i: number, value: Vec4) {
        this._indices[i*4 + 0] = value[0]
        this._indices[i*4 + 1] = value[1]
        this._indices[i*4 + 2] = value[2]
        this._indices[i*4 + 3] = value[3]
    }

    getWeight(i: number): Vec4 {
        return [
            this._weights[i*4 + 0],
            this._weights[i*4 + 1],
            this._weights[i*4 + 2],
            this._weights[i*4 + 3],
        ]
    }

    setWeight(i: number, value: Vec4) {
        this._weights[i*4 + 0] = value[0]
        this._weights[i*4 + 1] = value[1]
        this._weights[i*4 + 2] = value[2]
        this._weights[i*4 + 3] = value[3]
    }

    readSkinning(view: SimpleView, i: number) {
        this.setIndex(i, [view.readUint8(),view.readUint8(),view.readUint8(),view.readUint8()])
        this.setWeight(i, [view.readUint8(),view.readUint8(),view.readUint8(),view.readUint8()])
    }

    increaseSkinnings(add: number) {
        const newSize = this.numskinnings + add

        const ogIndices = this._indices
        const ogWeights = this._weights

        this.numskinnings = newSize

        this._indices.set(ogIndices)
        this._weights.set(ogWeights)
    }

    onlySkinnings(only: number[]) {
        const newSize = only.length

        const ogIndices = this._indices
        const ogWeights = this._weights

        this.numskinnings = newSize

        for (let i = 0; i < only.length; i++) {
            const j = only[i]

            const ogIndex: Vec4 = [
                ogIndices[j*4 + 0],
                ogIndices[j*4 + 1],
                ogIndices[j*4 + 2],
                ogIndices[j*4 + 3],
            ]

            const ogWeight: Vec4 = [
                ogWeights[j*4 + 0],
                ogWeights[j*4 + 1],
                ogWeights[j*4 + 2],
                ogWeights[j*4 + 3],
            ]

            this.setIndex(i, ogIndex)
            this.setWeight(i, ogWeight)
        }
    }

    getBone(name: string): FileMeshBone | undefined {
        for (const bone of this.bones) {
            if (bone.name === name) {
                return bone
            }
        }
    }
}

class QuantizedMatrix {
    rows: number
    columns: number

    matrix: number[] //always stored as v1 after read

    //only used when reading from file
    version: number
    v2_min?: number
    v2_max?: number

    constructor(version: number, rows: number, columns: number) {
        this.version = version
        this.rows = rows
        this.columns = columns
        this.matrix = new Array(rows * columns)
    }

    clone() {
        const copy = new QuantizedMatrix(this.version, this.rows, this.columns)
        
        for (let i = 0; i < this.matrix.length; i++) {
            copy.matrix[i] = this.matrix[i]
        }

        copy.v2_min = this.v2_min
        copy.v2_max = this.v2_max

        return copy
    }
}

class QuantizedTransform {
    px: QuantizedMatrix
    py: QuantizedMatrix
    pz: QuantizedMatrix

    rx: QuantizedMatrix
    ry: QuantizedMatrix
    rz: QuantizedMatrix

    constructor(px: QuantizedMatrix, py: QuantizedMatrix, pz: QuantizedMatrix, rx: QuantizedMatrix, ry: QuantizedMatrix, rz: QuantizedMatrix) {
        this.px = px
        this.py = py
        this.pz = pz

        this.rx = rx
        this.ry = ry
        this.rz = rz
    }

    clone() {
        return new QuantizedTransform(this.px.clone(), this.py.clone(), this.pz.clone(), this.rx.clone(), this.ry.clone(), this.rz.clone())
    }
}

type TwoPoseCorrective = Vec2
type ThreePoseCorrective = Vec3

/**
 * Class inside FileMesh that contains facial animation data
 * @category Mesh */
export class FACS {
    faceBoneNames: string[] = []
    faceControlNames: string[] = []
    quantizedTransforms?: QuantizedTransform

    twoPoseCorrectives: TwoPoseCorrective[] = []
    threePoseCorrectives: ThreePoseCorrective[] = []

    clone() {
        const copy = new FACS()

        for (const name of this.faceBoneNames) {
            copy.faceBoneNames.push(name)
        }

        for (const name of this.faceControlNames) {
            copy.faceControlNames.push(name)
        }

        if (this.quantizedTransforms) {
            copy.quantizedTransforms = this.quantizedTransforms.clone()
        }

        for (const twoPoseCorrective of this.twoPoseCorrectives) {
            copy.twoPoseCorrectives.push([twoPoseCorrective[0], twoPoseCorrective[1]])
        }

        for (const threePoseCorrective of this.threePoseCorrectives) {
            copy.threePoseCorrectives.push([threePoseCorrective[0], threePoseCorrective[1], threePoseCorrective[2]])
        }

        return copy
    }
}

function readSubset(view: SimpleView) {
    const subset = new FileMeshSubset()

    subset.facesBegin = view.readUint32()
    subset.facesLength = view.readUint32()

    subset.vertsBegin = view.readUint32()
    subset.vertsLength = view.readUint32()

    subset.numBoneIndices = view.readUint32()
    for (let i = 0; i < 26; i++) subset.boneIndices.push(view.readUint16());

    return subset
}

function readBone(view: SimpleView) {
    const bone = new FileMeshBone()

    bone.boneNameIndex = view.readUint32()

    bone.parentIndex = view.readUint16()
    bone.lodParentIndex = view.readUint16()

    bone.culling = view.readFloat32()

    const newMat: number[] = new Array(9)
    for (let i = 0; i < 9; i++) {
        newMat[i] = view.readFloat32()
    }
    bone.rotationMatrix = newMat as Mat3x3

    bone.position = [view.readFloat32(), view.readFloat32(), view.readFloat32()]

    return bone
}

function readQuantizedMatrix(view: SimpleView) {
    const version = view.readUint16()
    const rows = view.readUint32()
    const cols = view.readUint32()

    const quantizedMatrix = new QuantizedMatrix(version, rows, cols)

    switch (version) {
        case 1:
            for (let i = 0; i < rows * cols; i++) {
                quantizedMatrix.matrix[i] = view.readFloat32()
            }
            break
        case 2:
        {
            const v2_min = view.readFloat32()
            const v2_max = view.readFloat32()

            quantizedMatrix.v2_min = v2_min
            quantizedMatrix.v2_max = v2_max

            const precision = (v2_max - v2_min) / 65535

            for (let i = 0; i < rows * cols; i++) {
                quantizedMatrix.matrix[i] = v2_min + (view.readUint16() * precision)
            }

            break
        }
        default:
            throw new Error(`Unknown QuantizedMatrix version: ${version}`)
    }

    return quantizedMatrix
}

function readQuantizedTransform(view: SimpleView) {
    const px = readQuantizedMatrix(view)
    const py = readQuantizedMatrix(view)
    const pz = readQuantizedMatrix(view)

    const rx = readQuantizedMatrix(view)
    const ry = readQuantizedMatrix(view)
    const rz = readQuantizedMatrix(view)

    return new QuantizedTransform(px, py, pz, rx, ry, rz)
}

function readFACS(view: SimpleView) {
    const facs = new FACS()

    const sizeof_faceBoneNamesBlob = view.readUint32()
    const sizeof_faceControlNamesBlob = view.readUint32()
    /*const sizeof_quantizedTransforms =*/ view.readUint64()

    const sizeof_twoPoseCorrectives = view.readUint32()
    const sizeof_threePoseCorrectives = view.readUint32()

    const faceBoneNamesBlob = view.readUtf8String(sizeof_faceBoneNamesBlob)
    const faceControlNamesBlob = view.readUtf8String(sizeof_faceControlNamesBlob)

    facs.faceBoneNames = faceBoneNamesBlob.split("\0")
    facs.faceControlNames = faceControlNamesBlob.split("\0")
    facs.faceBoneNames.pop()
    facs.faceControlNames.pop()

    facs.quantizedTransforms = readQuantizedTransform(view)

    for (let i = 0; i < sizeof_twoPoseCorrectives / 4; i++) {
        facs.twoPoseCorrectives.push([view.readUint16(), view.readUint16()])
    }

    for (let i = 0; i < sizeof_threePoseCorrectives / 6; i++) {
        facs.threePoseCorrectives.push([view.readUint16(), view.readUint16(), view.readUint16()])
    }

    //add corrective poses to names list
    for (const twoPoseCorrective of facs.twoPoseCorrectives) {
        facs.faceControlNames.push(`${facs.faceControlNames[twoPoseCorrective[0]]} ${facs.faceControlNames[twoPoseCorrective[1]]}`)
    }

    for (const threePoseCorrective of facs.threePoseCorrectives) {
        facs.faceControlNames.push(`${facs.faceControlNames[threePoseCorrective[0]]} ${facs.faceControlNames[threePoseCorrective[1]]} ${facs.faceControlNames[threePoseCorrective[2]]}`)
    }
    
    return facs
}

/**
 * Obtained from a call to API.Asset.GetMesh()
 * @category Mesh
 */
export class FileMesh {
    version!: string //version (at start of file, including \n)
    facsDataFormat: number = 0
    sizeOfFacsData: number = 0
    
    coreMesh!: COREMESH //COREMESH
    lods!: LODS //LODS
    skinning!: SKINNING //SKINNING
    facs?: FACS
    hsrAvis?: HSRAVIS

    _bounds?: Bounds
    _size?: Vec3 = undefined

    get bounds(): Bounds {
        if (!this._bounds) {
        //max mesh size is 2048 i think? so this should be enough
            let minX = 999999
            let maxX = -999999

            let minY = 999999
            let maxY = -999999

            let minZ = 999999
            let maxZ = -999999

            if (this.coreMesh) {
                for (let i = 0; i < this.coreMesh.numverts; i++) {
                    const pos = this.coreMesh.getPos(i)

                    minX = Math.min(minX, pos[0])
                    maxX = Math.max(maxX, pos[0])

                    minY = Math.min(minY, pos[1])
                    maxY = Math.max(maxY, pos[1])

                    minZ = Math.min(minZ, pos[2])
                    maxZ = Math.max(maxZ, pos[2])
                }
            }

            this._bounds = [[minX, minY, minZ], [maxX, maxY, maxZ]]
        }

        return this._bounds
    }

    get size() {
        if (!this._size) {
            //max mesh size is 2048 i think? so this should be enough
            const [[minX, minY, minZ], [maxX, maxY, maxZ]] = this.bounds

            this._size = [maxX - minX, maxY - minY, maxZ - minZ]
        }

        return this._size
    }

    constructor() {
        this.reset()
    }

    clone() {
        const copy = new FileMesh()
        copy.version = this.version

        copy.facsDataFormat = this.facsDataFormat
        copy.sizeOfFacsData = this.sizeOfFacsData

        copy.coreMesh = this.coreMesh.clone()
        copy.lods = this.lods.clone()
        copy.skinning = this.skinning.clone()
        copy.facs = this.facs ? this.facs.clone() : undefined

        if (this._size) {
            copy._size = clonePrimitiveArray(this._size) as Vec3
        }

        return copy
    }

    reset() {
        this.version = "version 1.0.0\n"

        this.facsDataFormat = 0
        this.sizeOfFacsData = 0

        this.coreMesh = new COREMESH()
        this.lods = new LODS()
        this.skinning = new SKINNING()
        this.facs = undefined
    }

    /*recalculateNormals() {
        const core = this.coreMesh

        for (const vert of core.verts) {
            vert.normal = [0,0,0]
        }

        let faceStart = 0
        let faceEnd = core.faces.length
        if (this.lods) {
            if (this.lods.lodOffsets.length > 1) {
                faceStart = this.lods.lodOffsets[0]
                faceEnd = this.lods.lodOffsets[1]
            }
        }

        for (let i = faceStart; i < faceEnd; i++) {
            const face = core.faces[i]

            const p1 = core.verts[face.a].position
            const p2 = core.verts[face.b].position
            const p3 = core.verts[face.c].position

            const a = minus(p2, p1)
            const b = minus(p3, p1)

            const N: Vec3 = [
                a[1]*b[2] - a[2]*b[1],
                a[2]*b[0] - a[0]*b[2],
                a[0]*b[1] - a[1]*b[0],
            ]

            const magn = magnitude(N)

            const normal = divide(N, [magn,magn,magn])
            core.verts[face.a].normal = add(core.verts[face.a].normal, normal)
            core.verts[face.b].normal = add(core.verts[face.b].normal, normal)
            core.verts[face.c].normal = add(core.verts[face.c].normal, normal)
        }

        for (const vert of core.verts) {
            const magn = magnitude(vert.normal)
            if (magn > 0) {
                vert.normal = divide(vert.normal, [magn, magn, magn])
            } else {
                //console.log(vert)
            }
        }
    }*/

    async readChunk(view: SimpleView) {
        const chunkType = view.readUtf8String(8)
        const chunkVersion = view.readUint32()

        log(false, `Reading chunk: ${chunkType} version: ${chunkVersion}`)

        const size = view.readUint32()
        const newViewOffset = view.viewOffset + size
        
        switch (chunkType) {
            case "COREMESH":
                await this.readChunkCOREMESH(view, chunkVersion)
                break
            case "SKINNING":
                this.readChunkSKINNING(view, chunkVersion)
                break
            case "LODS\0\0\0\0":
                this.readChunkLODS(view, chunkVersion)
                break
            case "FACS\0\0\0\0":
                this.readChunkFACS(view, chunkVersion)
                break
            case "HSRAVIS\0":
                this.readChunkHSRAVIS(view, chunkVersion)
                break
            default:
                warn(true, `Unknown chunk found in mesh: ${chunkType}`)
                break
        }
        
        view.viewOffset = newViewOffset
    }

    readChunkLODS(view: SimpleView, version: number) {
        if (version !== 1) return

        this.lods.lodType = view.readUint16()
        this.lods.numHighQualityLODs = view.readUint8()

        //lodOffsets
        this.lods.numLodOffsets = view.readUint32()
        for (let i = 0; i < this.lods.numLodOffsets; i++) {
            this.lods.lodOffsets.push(view.readUint32())
        }
    }

    readChunkSKINNING(view: SimpleView, version: number) {
        if (version !== 1) return

        //vertex skinnings
        this.skinning.numskinnings = view.readUint32()
        for (let i = 0; i < this.skinning.numskinnings; i++) {
            this.skinning.readSkinning(view, i)
        }

        //bones
        const numBones = view.readUint32()
        for (let i = 0; i < numBones; i++) {
            this.skinning.bones.push(readBone(view))
        }

        //bone names
        const nameTableSize = view.readUint32()
        const nameTable: string[] = []
        const nameTableIndex: number[] = []
        let lastString = ""
        for (let i = 0; i < nameTableSize; i++) {
            if (view.readUint8() !== 0) {
                view.viewOffset--;
                lastString += view.readUtf8String(1)
            } else {
                nameTable.push(lastString)
                nameTableIndex.push(i - lastString.length)
                lastString = ""
            }
        }

        //map names to bones
        for (const bone of this.skinning.bones) {
            for (let i = 0; i < nameTable.length; i++) {
                if (nameTableIndex[i] === bone.boneNameIndex) {
                    bone.name = nameTable[i]
                    break
                }
            }
        }

        //update indices to work with subsets
        const numSubsets = view.readUint32()

        for (let i = 0; i < numSubsets; i++) {
            const subset = readSubset(view)

            for (let i = subset.vertsBegin; i < subset.vertsBegin + subset.vertsLength; i++) {
                const indices = this.skinning.getIndex(i)
                const newIndices = indices.map((v) => {return subset.boneIndices[v]}) as Vec4
                this.skinning.setIndex(i, newIndices)
            }
        }
    }

    readChunkHSRAVIS(view: SimpleView, version: number) {
        if (version !== 1) return

        this.hsrAvis = new HSRAVIS()

        const alwaysVisibleBitFlagsCount = view.readUint32()
        const alwaysVisibleBitFlagsLength = Math.floor((alwaysVisibleBitFlagsCount + 7) / 8)

        for (let i = 0; i < alwaysVisibleBitFlagsLength; i++) {
            const byteValue = view.readUint8()

            for (let j = 0; j < 8; j++) {
                this.hsrAvis.bitFlags.push((byteValue & Math.pow(2,j)) > 0)
            }
        }
    }

    async readChunkCOREMESH(view: SimpleView, version: number) {
        if (version === 1) {
            log(false, "COREMESH v1")
            this.coreMesh.numverts = view.readUint32()
            for (let i = 0; i < this.coreMesh.numverts; i++) {
                this.coreMesh.readVert(i, view)
            }

            this.coreMesh.numfaces = view.readUint32()
            for (let i = 0; i < this.coreMesh.numfaces; i++) {
                this.coreMesh.readFace(i, view)
            }
        } else if (version === 2) {
            log(false, "COREMESH v2")
            const dracoBitStreamSize = view.readUint32()
            const buffer = (view.buffer.slice(view.viewOffset, view.viewOffset + dracoBitStreamSize))
            //const dracoView = new SimpleView(buffer)
            //new DracoDecoder(dracoView)
            //console.log(dracoBitStreamSize, DracoDecoderModule)
            /*while (!DracoDecoderModule) {
                await new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(undefined)
                    },100)
                })
            }*/

            const decoderModule = await DracoDecoderModule()
            const decoder = new decoderModule.Decoder()

            const mesh = new decoderModule.Mesh();
            const status = decoder.DecodeArrayToMesh(new Int8Array(buffer), dracoBitStreamSize, mesh);
            if (!status.ok() || mesh.ptr === 0) {
                throw new Error("Draco decode failed");
            }

            this.coreMesh.numfaces = mesh.num_faces();
            this.coreMesh.numverts = mesh.num_points();

            const posAttr = decoder.GetAttributeByUniqueId(mesh, 0)
            if (posAttr.ptr === 0) {
                throw new Error("No position attribute")
            }

            const normalAttr = decoder.GetAttributeByUniqueId(mesh, 1)
            if (normalAttr.ptr === 0) {
                throw new Error("No normal attribute")
            }

            const uvAttr = decoder.GetAttributeByUniqueId(mesh, 2)
            if (uvAttr.ptr === 0) {
                throw new Error("No uv attribute")
            }

            const tangentAttr = decoder.GetAttributeByUniqueId(mesh, 3)
            if (tangentAttr.ptr === 0) {
                throw new Error("No tangent attribute")
            }

            const colorAttr = decoder.GetAttributeByUniqueId(mesh, 4)
            if (colorAttr.ptr === 0) {
                throw new Error("No color attribute")
            }

            const posArray = new decoderModule.DracoFloat32Array()
            const posSuccess = decoder.GetAttributeFloatForAllPoints(mesh, posAttr, posArray)
            const normalArray = new decoderModule.DracoFloat32Array()
            const normalSuccess = decoder.GetAttributeFloatForAllPoints(mesh, normalAttr, normalArray)
            const uvArray = new decoderModule.DracoFloat32Array()
            const uvSuccess = decoder.GetAttributeFloatForAllPoints(mesh, uvAttr, uvArray)
            const tangentArray = new decoderModule.DracoUInt8Array()
            const tangentSuccess = decoder.GetAttributeUInt8ForAllPoints(mesh, tangentAttr, tangentArray)
            const colorArray = new decoderModule.DracoUInt8Array()
            const colorSuccess = decoder.GetAttributeUInt8ForAllPoints(mesh, colorAttr, colorArray)

            if (posSuccess && normalSuccess && uvSuccess && tangentSuccess && colorSuccess) {
                for (let i = 0; i < this.coreMesh.numverts; i++) {
                    const pos: Vec3 = [posArray.GetValue(i * 3 + 0), posArray.GetValue(i * 3 + 1), posArray.GetValue(i * 3 + 2)]
                    const normal: Vec3 = [normalArray.GetValue(i * 3 + 0), normalArray.GetValue(i * 3 + 1), normalArray.GetValue(i * 3 + 2)]
                    const uv: Vec2 = [uvArray.GetValue(i * 2 + 0), uvArray.GetValue(i * 2 + 1)]
                    const tangent: Vec4 = [tangentArray.GetValue(i * 4 + 0) - 127, tangentArray.GetValue(i * 4 + 1) - 127, tangentArray.GetValue(i * 4 + 2) - 127, tangentArray.GetValue(i * 4 + 3) - 127]
                    const color: Vec4 = [colorArray.GetValue(i * 4 + 0), colorArray.GetValue(i * 4 + 1), colorArray.GetValue(i * 4 + 2), colorArray.GetValue(i * 4 + 3)]
                    
                    this.coreMesh.setPos(i, pos)
                    this.coreMesh.setNormal(i, normal)
                    this.coreMesh.setUV(i, uv)
                    this.coreMesh.setTangent(i, tangent)
                    this.coreMesh.setColor(i, color)
                }
            }
            decoderModule.destroy(posArray)
            decoderModule.destroy(normalArray)
            decoderModule.destroy(uvArray)
            decoderModule.destroy(tangentArray)
            decoderModule.destroy(colorArray)

            const faceArray = new decoderModule.DracoInt32Array()
            for (let i = 0; i < this.coreMesh.numfaces; i++) {
                /*const faceSuccess =*/ decoder.GetFaceFromMesh(mesh, i, faceArray)
                //if (faceSuccess) {
                    const faceVec3: Vec3 = [faceArray.GetValue(0), faceArray.GetValue(1), faceArray.GetValue(2)]
                    const [a,b,c] = faceVec3
                    this.coreMesh.setFace(i, faceVec3)

                    if (a >= this.coreMesh.numverts || b >= this.coreMesh.numverts || c >= this.coreMesh.numverts) {
                        warn(true, `Face ${i} has out-of-range index: ${a}, ${b}, ${c}`);
                        continue; // skip invalid face
                    }
                //}
            }
            decoderModule.destroy(faceArray)

            //console.log(decoder.GetMetadata(mesh))
            //console.log(decoder.GetAttribute(mesh, 0))

            decoderModule.destroy(mesh)
            decoderModule.destroy(decoder)

            log(false, this.coreMesh)
            /*const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath("../../draco/")
            dracoLoader.setDecoderConfig({ type: 'js' });
            const geometry = await new Promise(resolve => {
                dracoLoader.parse(view.buffer.slice(view.viewOffset, view.viewOffset + dracoBitStreamSize), (geometry) => {
                    resolve(geometry)
                })
            })
            console.log(geometry)*/
            
        }
    }

    readChunkFACS(view: SimpleView, version: number) {
        if (version !== 1) return

        view.readUint32() //size of facs data
        this.facs = readFACS(view)
    }

    async fromBuffer(buffer: ArrayBuffer) {
        this.reset()

        const view = new SimpleView(buffer)
        const version = view.readUtf8String(13)

        this.version = version

        switch (version) {
            case "version 1.00\r":
            case "version 1.00\n":
            case "version 1.01\r":
            case "version 1.01\n":
                {
                const bufferAsLines = new TextDecoder().decode(buffer).split("\n")
                this.coreMesh.numfaces = Number(bufferAsLines[1])
                this.coreMesh.numverts = this.coreMesh.numfaces * 3

                const vertData = bufferAsLines[2].replaceAll("[","").split("]")
                vertData.pop()

                for (let i = 0; i < this.coreMesh.numfaces; i++) {
                    for (let j = 0; j < 3; j++) {
                        const positionString = vertData[i*9 + j*3]
                        const normalString = vertData[i*9 + j*3 + 1]
                        const uvString = vertData[i*9 + j*3 + 2]

                        const readPosition = positionString.split(",").map((val) => {return Number(val)})
                        const position: Vec3 = [readPosition[0] || 0, readPosition[1] || 0, readPosition[2] || 0]
                        if (version.startsWith("version 1.00")) {
                            position[0] *= 0.5
                            position[1] *= 0.5
                            position[2] *= 0.5
                        }
                        const readNormal = normalString.split(",").map((val) => {return Number(val)})
                        const normal: Vec3 = [readNormal[0] || 0, readNormal[1] || 0, readNormal[2] || 0]
                        const readUv = uvString.split(",").map((val) => {return Number(val)})
                        if (readUv.length > 2) {
                            readUv.pop()
                        }
                        if (readUv[1]) {
                            readUv[1] = 1 - readUv[1]
                        }
                        const uv: Vec2 = [readUv[0] || 0, readUv[1] || 0]

                        this.coreMesh.setPos(i*3 + j, position)
                        this.coreMesh.setNormal(i*3 + j, normal)
                        this.coreMesh.setUV(i*3 + j, uv)
                        
                    }

                    this.coreMesh.setFace(i, [i*3 + 0, i*3 + 1, i*3 + 2])
                }

                break
                }
            case "version 2.00\n":
            case "version 3.00\n":
            case "version 3.01\n":
                {
                view.readUint16() //sizeOf_header
                const sizeOf_vert = view.readUint8() //important, 36 or 40 (without or with color)
                view.readUint8() //sizeOf_face

                //let sizeOf_LodOffset = 0
                let numLodOffsets = 0

                if (!version.startsWith("version 2")) { //has LODs
                    view.readUint16() //sizeOf_LodOffset
                    numLodOffsets = view.readUint16()
                    this.lods.numLodOffsets = numLodOffsets
                }

                this.coreMesh.numverts = view.readUint32()
                this.coreMesh.numfaces = view.readUint32()

                //verts
                for (let i = 0; i < this.coreMesh.numverts; i++) {
                    this.coreMesh.readVert(i, view, sizeOf_vert)
                }

                //faces
                for (let i = 0; i < this.coreMesh.numfaces; i++) {
                    this.coreMesh.readFace(i, view)
                }

                //lodOffsets
                for (let i = 0; i < numLodOffsets; i++) {
                    this.lods.lodOffsets.push(view.readUint32())
                }
                
                break
                }
            case "version 4.00\n":
            case "version 4.01\n":
            case "version 5.00\n":
                {
                //header
                view.readUint16() //sizeOf_header
                this.lods.lodType = view.readUint16()

                this.coreMesh.numverts = view.readUint32()
                this.coreMesh.numfaces = view.readUint32()

                this.lods.numLodOffsets = view.readUint16()
                const numBones = view.readUint16()

                const nameTableSize = view.readUint32()
                const numSubsets = view.readUint16()

                this.lods.numHighQualityLODs = view.readInt8()
                
                view.readInt8() //padding?

                if (version === "version 5.00\n") {
                    this.facsDataFormat = view.readUint32()
                    this.sizeOfFacsData = view.readUint32()
                }
                
                //verts
                for (let i = 0; i < this.coreMesh.numverts; i++) {
                    this.coreMesh.readVert(i, view)
                }

                //bones
                if (numBones > 0) {
                    //vertex skinnings
                    this.skinning.numskinnings = this.coreMesh.numverts
                    for (let i = 0; i < this.skinning.numskinnings; i++) {
                        this.skinning.readSkinning(view, i)
                    }
                }

                //faces
                for (let i = 0; i < this.coreMesh.numfaces; i++) {
                    this.coreMesh.readFace(i, view)
                }

                //lodOffsets
                for (let i = 0; i < this.lods.numLodOffsets; i++) {
                    this.lods.lodOffsets.push(view.readUint32())
                }

                //bones
                for (let i = 0; i < numBones; i++) {
                    this.skinning.bones.push(readBone(view))
                }

                //bone names
                const nameTable: string[] = []
                const nameTableIndex: number[] = []
                let lastString = ""
                for (let i = 0; i < nameTableSize; i++) {
                    if (view.readUint8() !== 0) {
                        view.viewOffset--;
                        lastString += view.readUtf8String(1)
                    } else {
                        nameTable.push(lastString)
                        nameTableIndex.push(i - lastString.length)
                        lastString = ""
                    }
                }

                //map names to bones
                for (const bone of this.skinning.bones) {
                    for (let i = 0; i < nameTable.length; i++) {
                        if (nameTableIndex[i] === bone.boneNameIndex) {
                            bone.name = nameTable[i]
                            break
                        }
                    }
                }

                //update indices to work with subsets
                for (let i = 0; i < numSubsets; i++) {
                    const subset = readSubset(view)

                    for (let i = subset.vertsBegin; i < subset.vertsBegin + subset.vertsLength; i++) {
                        const indices = this.skinning.getIndex(i)
                        const newIndices = indices.map((v) => {return subset.boneIndices[v]}) as Vec4
                        this.skinning.setIndex(i, newIndices)
                    }
                }

                //facs
                if (version === "version 5.00\n" && this.facsDataFormat === 1 && this.sizeOfFacsData > 0) {
                    this.facs = readFACS(view)
                }

                break
                }
            case "version 6.00\n":
            case "version 7.00\n":
                while (view.viewOffset < view.buffer.byteLength - 1) {
                    await this.readChunk(view)
                }
                break
            default:
                warn(true, `Failed to read mesh, unknown version: ${version}`)
        }

        const issue = this.getValidationIssue()
        if (issue) {
            warn(true, `Issue with parsed mesh: ${issue}`)
        }

        log(false, `Bytes left: ${view.view.byteLength - view.viewOffset}`)
        /*if (this.skinning && this.skinning.skinnings.length > 0) {
            console.log(this)
        }*/
        if (this.skinning.numskinnings > 0) {
            log(false, this.skinning)
        }
    }

    stripLODS() {
        let facesEnd = this.coreMesh.numfaces
        let facesStart = 0
        if (this.lods) {
            if (this.lods.lodOffsets.length >= 2) {
                facesStart = this.lods.lodOffsets[0]
                facesEnd = this.lods.lodOffsets[1]
                if (facesEnd === 0) {
                    facesEnd = this.coreMesh.numfaces
                }
            }
        }

        this.coreMesh.sliceFaces(facesStart, facesEnd)

        this.lods.lodOffsets = [0, 0]
    }

    padSkinnings() {
        const vertsLength = this.coreMesh.numverts
        const skinningsLength = this.skinning.numskinnings
        const missingCount = vertsLength - skinningsLength

        this.skinning.increaseSkinnings(missingCount)

        for (let i = skinningsLength; i < vertsLength; i++) {
            this.skinning.setIndex(i, [0,0,0,0])
            this.skinning.setWeight(i, [0,0,0,0])
        }

        if (this.skinning.bones.length === 0) {
            const bone = new FileMeshBone()
            bone.name = "Root"
            bone.boneNameIndex = 0
            bone.lodParentIndex = 65535
            bone.parentIndex = 65535
            bone.position = [0,0,0]
            bone.rotationMatrix = [1,0,0,0,1,0,0,0,1]
            this.skinning.bones.push(bone)
        }
    }

    setBoneSource(name: string) {
        for (const bone of this.skinning.bones) {
            bone.sourcePart = name
        }
    }

    setBoneSourceSize() {
        for (const bone of this.skinning.bones) {
            bone.sourceSize = this.size
        }
    }

    combine(other: FileMesh) {
        //TODO: take LODS into consideration
        this.stripLODS()
        other = other.clone()
        other.stripLODS()

        if (this.skinning.numskinnings > 0 || other.skinning.numskinnings > 0) {
            this.padSkinnings()
            other.padSkinnings()
        }

        const facesLength = this.coreMesh.numfaces
        const vertsLength = this.coreMesh.numverts

        //coremesh
        this.coreMesh.increaseVerts(other.coreMesh.numverts)
        for (let i = 0; i < other.coreMesh.numverts; i++) {
            this.coreMesh.setPos(vertsLength + i, other.coreMesh.getPos(i))
            this.coreMesh.setNormal(vertsLength + i, other.coreMesh.getNormal(i))
            this.coreMesh.setUV(vertsLength + i, other.coreMesh.getUV(i))
            this.coreMesh.setTangent(vertsLength + i, other.coreMesh.getTangent(i))
            this.coreMesh.setColor(vertsLength + i, other.coreMesh.getColor(i))
        }

        this.coreMesh.increaseFaces(other.coreMesh.numfaces)
        for (let i = 0; i < other.coreMesh.numfaces; i++) {
            this.coreMesh.setFace(facesLength + i, other.coreMesh.getFace(i))
        }

        this.lods.lodOffsets = [0, this.coreMesh.numfaces - 1]

        //facs
        if (other.facs) {
            this.facs = other.facs.clone()
        }

        //skeleton
        const boneIndexMap = new Map<number,number>()

        for (const bone of other.skinning.bones) {
            const foundBone = bone.name ? this.skinning.getBone(bone.name) : undefined

            //root
            if (bone.parentIndex >= 65535) {
                boneIndexMap.set(other.skinning.bones.indexOf(bone), 0)
                continue
            }

            //not root
            if (foundBone) { //if bone already inside, just map old one to that
                boneIndexMap.set(other.skinning.bones.indexOf(bone), this.skinning.bones.indexOf(foundBone))
            } else { //else copy bone to the original mesh
                const parentBone = other.skinning.bones[bone.parentIndex]
                const parentName = parentBone.name
                const foundParentBone = parentName ? this.skinning.getBone(parentName) : undefined

                //copy self bone to other
                const boneCopy = bone.clone()
                boneCopy.parentIndex = 65535
                boneCopy.lodParentIndex = 65535

                if (foundParentBone) {
                    const foundParentIndex = this.skinning.bones.indexOf(foundParentBone)
                    boneCopy.parentIndex = foundParentIndex
                    boneCopy.lodParentIndex = foundParentIndex
                }

                this.skinning.bones.push(boneCopy)
                
                boneIndexMap.set(other.skinning.bones.indexOf(bone), this.skinning.bones.length - 1)
            }
        }

        //console.log(boneIndexMap)
        //console.log(this)

        const ogSkinningsSize = this.skinning.numskinnings

        this.skinning.increaseSkinnings(other.skinning.numskinnings)
        for (let i = 0; i < other.skinning.numskinnings; i++) {
            this.skinning.setIndex(ogSkinningsSize + i,
                other.skinning.getIndex(i).map((v) => {return boneIndexMap.get(v)}) as Vec4
            )
            this.skinning.setWeight(ogSkinningsSize + i, other.skinning.getWeight(i))
        }
    }

    removeDuplicateVertices(distance = 0.0001): number {
        const posToIndex = new Map<number, number>()
        const remap: number[] = new Array(this.coreMesh.numverts).fill(-1)
        const vertToSubset: number[] = new Array(this.coreMesh.numverts).fill(-1)

        //detect duplicates
        for (let i = 0; i < this.coreMesh.numverts; i++) {
            const pos = this.coreMesh.getPos(i)
            const uv = this.coreMesh.getUV(i)

            const hash = hashVec3(pos[0], pos[1], pos[2], distance) + hashVec2(uv[0], uv[1])

            const existing = posToIndex.get(hash)

            if (existing !== undefined) {
                //duplicate -> map to existing
                remap[i] = existing

                //merge normals
                const a = this.coreMesh.getNormal(existing)
                const b = this.coreMesh.getNormal(i)
                const merged = new Vector3().fromVec3(a).add(new Vector3().fromVec3(b)).normalize()
                this.coreMesh.setNormal(existing, merged.toVec3())

            } else {
                posToIndex.set(hash, i)
                remap[i] = i
            }
        }

        //remap faces
        for (let i = 0; i < this.coreMesh.numfaces; i++) {
            const remapFace = this.coreMesh.getFace(remap[i])
            this.coreMesh.setFace(i, clonePrimitiveArray(remapFace) as Vec3)
        }

        //build new compact vertex array
        const newVerts: number[] = []
        const newSkinnings: number[] = []
        const newSubsetIndices = []
        const newIndex = new Map<number, number>()

        for (let i = 0; i < this.coreMesh.numverts; i++) {
            const canonical = remap[i]
            if (!newIndex.has(canonical)) {
                newIndex.set(canonical, newVerts.length)
                newVerts.push(canonical)
                newSubsetIndices.push(vertToSubset[i])
                newSkinnings.push(canonical)
            }
            remap[i] = newIndex.get(canonical)!
        }

        //Fix faces again to use compact indices
        for (let i = 0; i < this.coreMesh.numfaces; i++) {
            const remapFace = this.coreMesh.getFace(remap[i])
            this.coreMesh.setFace(i, clonePrimitiveArray(remapFace) as Vec3)
        }

        this.coreMesh.onlyVerts(newVerts)
        this.skinning.onlySkinnings(newSkinnings)
        
        return newVerts.length
    }

    /*removeFace(index: number) {
        this.coreMesh.faces.splice(index, 1)
    }*/

    removeFaces(indices: number[]) {
        const onlyFaces: number[] = []
        for (let i = 0; i < this.coreMesh.numfaces; i++) {
            if (!indices.includes(i)) {
                onlyFaces.push(i)
            }
        }

        this.coreMesh.onlyFaces(onlyFaces)
    }

    basicSkin(boneNames: string[]) {
        //basic template
        this.skinning = new SKINNING()
        this.skinning.numskinnings = this.coreMesh.numverts
        this.skinning.bones = new Array(boneNames.length)

        //skinnings
        for (let i = 0; i < this.coreMesh.numverts; i++) {
            this.skinning.setIndex(i, [boneNames.length - 1,0,0,0])
            this.skinning.setWeight(i, [255,0,0,0])
        }

        //bone
        for (let i = 0; i < boneNames.length; i++) {
            const bone = new FileMeshBone()
            bone.name = boneNames[i]
            bone.parentIndex = i - 1
            if (bone.parentIndex < 0) {
                bone.parentIndex = 65535
            }
            bone.position = [0,0,0]
            bone.rotationMatrix = [1,0,0, 0,1,0, 0,0,1]
            bone.lodParentIndex = bone.parentIndex
            this.skinning.bones[i] = bone
        }
    }

    getValidationIssue(): "subsetLengthMismatch" | undefined {
        return undefined
    }
}

/*
fetch("https://assetdelivery.roblox.com/v1/asset?id=3039304183").then((response) => {
    return response.arrayBuffer()
}).then(buffer => {
    let mesh = new FileMesh()
    mesh.fromBuffer(buffer)
    console.log(mesh)
})
*/

/*4.01 mesh list
7603177870
*/

/*3.00 mesh list
4827174023
*/

/*2.00 mesh list
3039304183
*/

/*1.00 mesh list
1555971721 (HAS \r INSTEAD OF \n)
227430350 (same as above)
425078435 (same as above)
*/