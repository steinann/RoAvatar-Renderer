//https://www.freepatentsonline.com/y2023/0124297.html
/*
1. Calculate threshold:
    a. For each face on an outer cage (calculateCloseToCageThreshold)
        i. calculate a distance between the face on the outer cage and the closest face on the render mesh
    b. Get the middle value of the distance as the threshold value
2. Find all faces on render mesh that need to be cluster (meshFacesOutsideOfOuterCage)
    a. The algorithm only wants to cluster when the face on the render mesh is outside of the outer cage
    b. For each face on the render mesh:
        i. If the face’s distance to the closest outer cage is larger than the threshold
        ii. AND when rays are shot from the face, at least one ray will not hit the outer cage,
        iii. Then the face needs to be clustered because it probably is outside of the outer cage
3. Group together those faces of the render mesh that are determined above to be outside of the outer cage (generateClusterForFacesOnMeshOutsideOfOuterCage)
    a. For each face on the render mesh that needs clustering:
        i. Find the face’s adjacent faces on the render mesh
        ii. If the adjacent face(s) needs clustering, add the face(s) into one group
4. Update the map of the render mesh to the related outer cage:
    a. For each cluster of render faces:
        i. For each render face in the cluster:
            1. Find all the related outer cage faces
            2. Add these outer cage faces into a cluster of related outer cage faces
            3. Update the related outer cage face of all faces in the cluster of related outer cage faces to each render face in the cluster of render face cluster
*/

import * as THREE from 'three';
import { MeshCollider, Ray } from "../misc/collision"
import { nearestSearch, type KDNode } from "../misc/kd-tree-3"
import type { FileMesh, Vec3 } from "./mesh"
import { add, averageVec3, buildFaceKD, cross, distance, divide, minus, multiply, normalize } from "./mesh-deform"
import { RBXRenderer } from '../render/renderer';
import { FLAGS } from '../misc/flags';

/*function spreadVector(theta: number, phi: number): Vec3 {
    const normal: Vec3 = [
        -Math.sin(phi),
        -Math.cos(phi) * Math.sin(theta),
        -Math.cos(phi) * Math.cos(theta)
    ]

    return normal
}*/

const hitMaterial = new THREE.LineBasicMaterial({
  color: 0x00ff00
})

const missMaterial = new THREE.LineBasicMaterial({
  color: 0xff0000
})

export class HSR {
    rayCount: number = FLAGS.HSR_RAY_COUNT
    rayLength: number = FLAGS.HSR_RAY_LENGTH
    cullType: "front" | "back" = "back"
    phiAngle = 0

    mesh: FileMesh
    inner: FileMesh
    outer: FileMesh

    meshCollider: MeshCollider

    meshFaceKD?: KDNode | null

    outerThresholds?: number[]

    innerHits?: number[]

    constructor(mesh: FileMesh, inner: FileMesh, outer: FileMesh) {
        this.mesh = mesh
        this.inner = inner
        this.outer = outer

        this.mesh.stripLODS()
        this.inner.stripLODS()
        this.outer.stripLODS()

        this.meshCollider = new MeshCollider(this.mesh, 3)
    }

    getRays(mesh: FileMesh, index: number): Ray[] {
        const triangle = mesh.coreMesh.getTriangle(index)
        //const trianglePos = averageVec3(triangle)

        const U = minus(triangle[1], triangle[0])
        const V = minus(triangle[2], triangle[0])

        const normal = normalize(cross(U, V))
        /*const tangent = normalize(U)
        const bitangent = cross(normal, tangent)

        const matrix: Mat3x3 = [
            ...tangent,
            ...bitangent,
            ...normal,
        ]*/

        const rays: Ray[] = []

        for (let i = 0; i < this.rayCount; i++) {
            //const theta = Math.random() * 2 * Math.PI
            //const phi = Math.acos(2 * this.phiAngle * Math.random() - 1 * this.phiAngle)

            //const spread = spreadVector(theta, phi)

            //const rotatedSpread = multiply(multiplyMatrixVector(matrix, spread), [this.rayLength, this.rayLength, this.rayLength])
            const rotatedSpread = multiply(normal, [this.rayLength, this.rayLength, this.rayLength])

            let newPosBarycentric: Vec3 = [Math.random(), Math.random(), Math.random()]
            let total = newPosBarycentric[0] + newPosBarycentric[1] + newPosBarycentric[2]
            if (total === 0) {
                newPosBarycentric[0] = 1
                total = 1
            }
            newPosBarycentric = divide(newPosBarycentric, [total,total,total])

            const [a,b,c] = newPosBarycentric

            const newPos = add(add(multiply(triangle[0], [a,a,a]), multiply(triangle[1], [b,b,b])), multiply(triangle[2], [c,c,c]))

            const ray = new Ray(add(newPos, rotatedSpread), newPos)

            rays.push(ray)
        }

        return rays
    }

    calculateInnerHits() {
        this.meshCollider.cullType = this.cullType
        this.innerHits = new Array(this.inner.coreMesh.numfaces).fill(0)

        for (let i = 0; i < this.inner.coreMesh.numfaces; i++) {
            const rays = this.getRays(this.inner, i)
            let hits = 0

            for (const ray of rays) {
                const rayHit = this.meshCollider.raycast(ray)
                if (rayHit) {
                    hits += 1
                }

                if (FLAGS.HSR_SHOW_RAY) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...ray.origin), new THREE.Vector3(...ray.end)])

                    const line = new THREE.Line(geometry, rayHit ? hitMaterial : missMaterial)
                    RBXRenderer.getScene().add(line)
                }
            }

            this.innerHits[i] = hits
        }

        return this.innerHits
    }

    calculateCloseToCageThreshold() {
        if (!this.meshFaceKD) {
            this.meshFaceKD = buildFaceKD(this.mesh)
        }

        this.outerThresholds = new Array(this.outer.coreMesh.numfaces)
        for (let i = 0; i < this.outer.coreMesh.numfaces; i++) {
            const triangle = this.outer.coreMesh.getTriangle(i)
            const trianglePos = averageVec3(triangle)

            const closestFaceResult = nearestSearch(this.meshFaceKD, trianglePos)
            const closestTriangle = this.mesh.coreMesh.getTriangle(closestFaceResult.index)
            const closestTrianglePos = averageVec3(closestTriangle)

            const dist = distance(trianglePos, closestTrianglePos)

            this.outerThresholds[i] = dist/2
        }
    }
}