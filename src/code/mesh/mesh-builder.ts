import { FileMesh, type Vec2, type Vec3 } from "./mesh";

/**
 * Give it a tri like this
 *     B
 *    / \
 *   /   \
 *  /     \
 * C-------A
 */
export function addTri(mesh: FileMesh, totalVerts: number, totalFaces: number,
    a: Vec3, b: Vec3, c: Vec3,
    an: Vec3, bn?: Vec3, cn?: Vec3,
    auv: Vec2 = [0,0], buv: Vec2 = [0,0], cuv: Vec2 = [0,0]): number
    {
    if (!bn) bn = an
    if (!cn) cn = an

    mesh.coreMesh.setPos(totalVerts++, a)
    mesh.coreMesh.setPos(totalVerts++, b)
    mesh.coreMesh.setPos(totalVerts++, c)
    totalVerts -= 3
    mesh.coreMesh.setNormal(totalVerts++, an)
    mesh.coreMesh.setNormal(totalVerts++, bn)
    mesh.coreMesh.setNormal(totalVerts++, cn)
    totalVerts -= 3
    mesh.coreMesh.setUV(totalVerts++, auv)
    mesh.coreMesh.setUV(totalVerts++, buv)
    mesh.coreMesh.setUV(totalVerts++, cuv)
    mesh.coreMesh.setFace(totalFaces, [totalVerts-3, totalVerts-2, totalVerts-1])

    return totalVerts
}
/**
 * Give it a quad like this
 *  A---------B
 *  |         |
 *  |         |
 *  |         |
 *  |         |
 *  D---------C
 */
export function addQuad(mesh: FileMesh, totalVerts: number, totalFaces: number,
    a: Vec3, b: Vec3, c: Vec3, d: Vec3,
    an: Vec3, bn?: Vec3, cn?: Vec3, dn?: Vec3,
    auv: Vec2 = [0,0], buv: Vec2 = [0,0], cuv: Vec2 = [0,0], duv: Vec2 = [0,0]): number {
    if (!bn) bn = an
    if (!cn) cn = an
    if (!dn) dn = an

    totalVerts = addTri(mesh, totalVerts, totalFaces, c, b, a, cn, bn, an, cuv, buv, auv);
    totalVerts = addTri(mesh, totalVerts, totalFaces+1, c, a, d, cn, an, dn, cuv, auv, duv);

    return totalVerts
}

export function buildCube(x: number, y: number, z: number) {
    const mesh = new FileMesh()
    mesh.coreMesh.increaseVerts(3 * 2 * 6)
    mesh.coreMesh.increaseFaces(2 * 6)
    
    let totalVerts = 0
    let totalFaces = 0
    //top
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,y,-z],[x,y,-z],[x,y,z],[-x,y,z], [0,1,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //bottom
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,-y,z],[x,-y,z],[x,-y,-z],[-x,-y,-z], [0,-1,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //back
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,y,z],[x,y,z],[x,-y,z],[-x,-y,z], [0,0,1],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //front
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [x,y,-z],[-x,y,-z],[-x,-y,-z],[x,-y,-z], [0,0,-1],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //left
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,y,-z],[-x,y,z],[-x,-y,z],[-x,-y,-z], [-1,0,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //right
    /*totalVerts = */addQuad(mesh, totalVerts, totalFaces, [x,y,z],[x,y,-z],[x,-y,-z],[x,-y,z], [1,0,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])

    return mesh
}

export function buildWedge(x: number, y: number, z: number) {
    const mesh = new FileMesh()
    mesh.coreMesh.increaseVerts(3 * 2 * 5)
    mesh.coreMesh.increaseFaces(2 * 5)
    
    let totalVerts = 0
    let totalFaces = 0
    //top
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,-y,-z],[x,-y,-z],[x,y,z],[-x,y,z], [0,1,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //bottom
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,-y,z],[x,-y,z],[x,-y,-z],[-x,-y,-z], [0,-1,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //back
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,y,z],[x,y,z],[x,-y,z],[-x,-y,z], [0,0,1],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //left
    totalVerts = addQuad(mesh, totalVerts, totalFaces, [-x,-y,-z],[-x,y,z],[-x,-y,z],[-x,-y,-z], [-1,0,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])
    totalFaces += 2
    //right
    /*totalVerts = */addQuad(mesh, totalVerts, totalFaces, [x,y,z],[x,-y,-z],[x,-y,-z],[x,-y,z], [1,0,0],undefined,undefined,undefined, [0,0],[1,0],[1,1],[0,1])

    return mesh
}