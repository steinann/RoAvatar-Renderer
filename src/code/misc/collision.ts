import type { FileMesh, Triangle, Vec3 } from "../mesh/mesh"
import { add, cross, dot, minus, multiply, normalize } from "../mesh/mesh-deform"
import { OctreeChild, OctreeNode } from "./oct-tree"

export type Bounds = [Vec3, Vec3]

export class Ray {
    origin: Vec3
    end: Vec3

    constructor(origin: Vec3, end: Vec3) {
        this.origin = origin
        this.end = end
    }
}

export function RayBoundsCollide(ray: Ray, bounds: Bounds) {
    const o = ray.origin
    const d = minus(ray.end, o)

    let tminX = (bounds[0][0] - o[0]) / d[0]
    let tmaxX = (bounds[1][0] - o[0]) / d[0]
    if (d[0] < 0) [tminX, tmaxX] = [tmaxX, tminX]

    let tminY = (bounds[0][1] - o[1]) / d[1]
    let tmaxY = (bounds[1][1] - o[1]) / d[1]
    if (d[1] < 0) [tminY, tmaxY] = [tmaxY, tminY]

    let tminZ = (bounds[0][2] - o[2]) / d[2]
    let tmaxZ = (bounds[1][2] - o[2]) / d[2]
    if (d[2] < 0) [tminZ, tmaxZ] = [tmaxZ, tminZ]

    const tentry = Math.max(tminX, tminY, tminZ)
    const texit = Math.min(tmaxX, tmaxY, tmaxZ)

    return tentry < texit && texit > 0 && tentry < 1
}

//Source: https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm#C++_implementation
export function ray_intersects_triangle(ray: Ray, triangle: Triangle, cullType: "front" | "back"): Vec3 | null {
    const ray_origin = ray.origin
    const ray_vector = minus(ray.end, ray.origin)

    const epsilon: number = Number.EPSILON;

    const edge1: Vec3 = minus(triangle[1], triangle[0]);
    const edge2: Vec3 = minus(triangle[2], triangle[0]);

    // Backface culling for CCW-wound triangles.
    const normal: Vec3 = normalize(cross(edge1, edge2));
    if (cullType === "back" && dot(normal, ray_vector) > 0) return null;
    if (cullType === "front" && dot(normal, ray_vector) < 0) return null;

    const ray_cross_e2: Vec3 = cross(ray_vector, edge2);
    const det: number = dot(edge1, ray_cross_e2);

    if (Math.abs(det) < epsilon) return null; // Ray is parallel to triangle

    const inv_det: number = 1.0 / det;
    const s: Vec3 = minus(ray_origin, triangle[0]);
    const u: number = inv_det * dot(s, ray_cross_e2);

    if (u < 0.0 || u > 1.0) return null; // Ray passes outside edge2's bounds

    const s_cross_e1: Vec3 = cross(s, edge1);
    const v: number = inv_det * dot(ray_vector, s_cross_e1);

    if (v < 0.0 || u + v > 1.0) return null; // Ray passes outside edge1's bounds

    // The ray line intersects with the triangle.
    // We compute t to find where on the ray the intersection is.
    const t: number = inv_det * dot(edge2, s_cross_e1);

    if (t > epsilon) // Ray intersection
    {
        return add(ray_origin, multiply(ray_vector, [t,t,t]));
    }
    else // This means that there is a line intersection but not a ray intersection.
        return null;
}

export function calculateBounds(arr: Vec3[]): Bounds {
    const xValues = arr.map((v) => {return v[0]})
    const yValues = arr.map((v) => {return v[1]})
    const zValues = arr.map((v) => {return v[2]})

    return [[Math.min(...xValues), Math.min(...yValues), Math.min(...zValues)],[Math.max(...xValues), Math.max(...yValues), Math.max(...zValues)]]
}

export function calculateMeshFaceBounds(mesh: FileMesh) {
    const boundArray: Bounds[] = new Array(mesh.coreMesh.numfaces)
    for (let i = 0; i < mesh.coreMesh.numfaces; i++) {
        boundArray[i] = calculateBounds(mesh.coreMesh.getTriangle(i))
    }
    return boundArray
}

export class MeshCollider {
    mesh: FileMesh
    octree: OctreeNode<number>
    faceBounds: Bounds[]
    cullType: "front" | "back" = "back"
    
    constructor(mesh: FileMesh, octdepth: number = 3) {
        this.mesh = mesh
        mesh.stripLODS()

        this.faceBounds = calculateMeshFaceBounds(mesh)

        this.octree = new OctreeNode<number>(mesh.bounds)

        for (let i = 0; i < mesh.coreMesh.numfaces; i++) {
            const bounds = this.faceBounds[i]
            this.octree.children.push(new OctreeChild<number>(bounds, i))
        }

        for (let i = 0; i < octdepth; i++) {
            this.octree.divide()
        }
    }

    raycast(ray: Ray): boolean {
        /*const collidingNodes = this.octree.collide((bounds) => {
            return RayBoundsCollide(ray, bounds)
        })*/
       const collidingNodes = this.octree.collideRay(ray)

        for (const node of collidingNodes) {
            for (const child of node.children) {
                const index = child.data
                const bounds = this.faceBounds[index]
                if (RayBoundsCollide(ray, bounds)) {
                    if (ray_intersects_triangle(ray, this.mesh.coreMesh.getTriangle(index), this.cullType)) {
                        return true
                    }
                }
            }
        }

        return false
    }
}