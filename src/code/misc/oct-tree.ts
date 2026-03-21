import type { Vec3 } from "../mesh/mesh";
import type { Bounds } from "./collision";
import { lerp } from "./misc";

export class OctreeChild<T> {
    bounds: Bounds
    data: T

    constructor(bounds: Bounds, data: T) {
        this.bounds = bounds
        this.data = data
    }
}

export class OctreeNode<T> {
    bounds: Bounds
    children: OctreeChild<T>[] = []
    isEnd: boolean = true

    ufr?: OctreeNode<T> //ufr = upper front right = yzx (eww)
    ufl?: OctreeNode<T>
    ubr?: OctreeNode<T>
    ubl?: OctreeNode<T>
    lfr?: OctreeNode<T>
    lfl?: OctreeNode<T>
    lbr?: OctreeNode<T>
    lbl?: OctreeNode<T>

    constructor(bounds: Bounds) {
        this.bounds = bounds
    }

    getDivisions() {
        return [this.ufr, this.ufl, this.ubr, this.ubl, this.lfr, this.lfl, this.lbr, this.lbl]
    }
    
    divide() {
        if (!this.isEnd) {
            this.ufr?.divide()
            this.ufl?.divide()
            this.ubr?.divide()
            this.ubl?.divide()
            this.lfr?.divide()
            this.lfl?.divide()
            this.lbr?.divide()
            this.lbl?.divide()
            return
        }

        if (this.children.length <= 0) return

        this.isEnd = false

        //get midpoints
        const upperLowerMid = lerp(this.bounds[0][1], this.bounds[1][1], 0.5)
        const frontBackMid = lerp(this.bounds[0][2], this.bounds[1][2], 0.5)
        const rightLeftMid = lerp(this.bounds[0][0], this.bounds[1][0], 0.5)
        const mid: Vec3 = [rightLeftMid, upperLowerMid, frontBackMid]

        //create nodes
        this.ufr = new OctreeNode<T>([mid, this.bounds[1]])
        this.ufl = new OctreeNode<T>([[this.bounds[0][0], mid[1], mid[2]], [mid[0], this.bounds[1][1], this.bounds[1][2]]])
        this.ubr = new OctreeNode<T>([[mid[0], mid[1], this.bounds[0][2]], [this.bounds[1][0], this.bounds[1][1], mid[2]]])
        this.ubl = new OctreeNode<T>([[this.bounds[0][0], mid[1], this.bounds[0][2]], [mid[0], this.bounds[1][1], mid[2]]])
        this.lfr = new OctreeNode<T>([[mid[0], this.bounds[0][1], mid[2]], [this.bounds[1][0], mid[1], this.bounds[1][2]]])
        this.lfl = new OctreeNode<T>([[this.bounds[0][0], this.bounds[0][1], mid[2]], [mid[0], mid[1], this.bounds[1][2]]])
        this.lbr = new OctreeNode<T>([[mid[0], this.bounds[0][1], this.bounds[0][2]], [this.bounds[1][0], mid[1], mid[2]]])
        this.lbl = new OctreeNode<T>([this.bounds[0], mid])

        //add children to nodes
        for (const child of this.children) {
            const [minX, minY, minZ] = child.bounds[0]
            const [maxX, maxY, maxZ] = child.bounds[1]

            let left = false
            let right = false
            let upper = false
            let lower = false
            let front = false
            let back = false

            //right and left
            if (maxX > rightLeftMid) {
                right = true
            }

            if (minX < rightLeftMid) {
                left = true
            }

            //upper and lower
            if (maxY > upperLowerMid) {
                upper = true
            }

            if (minY < upperLowerMid) {
                lower = true
            }

            //front and back
            if (maxZ > frontBackMid) {
                front = true
            }

            if (minZ < frontBackMid) {
                back = true
            }

            if (upper && front && right) this.ufr.children.push(child)
            if (upper && front && left) this.ufl.children.push(child)
            if (upper && back && right) this.ubr.children.push(child)
            if (upper && back && left) this.ubl.children.push(child)
            if (lower && front && right) this.lfr.children.push(child)
            if (lower && front && left) this.lfl.children.push(child)
            if (lower && back && right) this.lbr.children.push(child)
            if (lower && back && left) this.lbl.children.push(child)
        }

        this.children = []
    }

    collide(func: (a: Bounds) => boolean): OctreeNode<T>[] {
        if (this.isEnd) {
            return func(this.bounds) ? [this] : []
        } else {
            const total = []

            if (func(this.bounds)) {
                const divisions = this.getDivisions()
                for (const division of divisions) {
                    if (!division || (division.children.length <= 0 && division.isEnd)) continue

                    total.push(...division.collide(func))
                }
            }

            return total
        }
    }
}