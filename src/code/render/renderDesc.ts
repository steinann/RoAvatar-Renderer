import * as THREE from 'three'
import type { CFrame, Instance } from "../rblx/rbx"
import { disposeMesh, type RBXRendererScene } from './renderer';
import { rad } from '../misc/misc';

export const RenderDescsToRegister: (typeof RenderDesc)[] = []
export const RenderDescClassTypes = new Map<string, typeof RenderDesc>()

function getRenderDescForClass(className: string): typeof RenderDesc | undefined {
    return RenderDescClassTypes.get(className)
}

export function getRenderDescForInstance(instance: Instance): typeof RenderDesc | undefined {
    const potentialRenderDesc = getRenderDescForClass(instance.className)
    if (potentialRenderDesc && potentialRenderDesc.shouldRenderInstance(instance)) return potentialRenderDesc
    return undefined
}

export function setTHREEObjectCF(threeObject: THREE.Object3D, cframe: CFrame) {
    threeObject.position.set(cframe.Position[0], cframe.Position[1], cframe.Position[2])
    threeObject.rotation.order = "YXZ"
    threeObject.rotation.x = rad(cframe.Orientation[0])
    threeObject.rotation.y = rad(cframe.Orientation[1])
    threeObject.rotation.z = rad(cframe.Orientation[2])
}

export class DisposableDesc {
    disposeMesh(scene: THREE.Scene, mesh: THREE.Mesh) {
        disposeMesh(scene, mesh)
    }

    disposeMeshes(scene: THREE.Scene, meshes: THREE.Mesh[]) {
        for (const mesh of meshes) {
            this.disposeMesh(scene, mesh)
        }
    }

    disposeRenderLists(renderer: THREE.WebGLRenderer) {
        renderer.renderLists.dispose()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dispose(_renderer: THREE.WebGLRenderer, _scene: THREE.Scene) {
        throw new Error("Virtual method dispose called")
    }
}

/**
 * Abstract class used to describe all rendered instances
 */
export class RenderDesc extends DisposableDesc {
    static classTypes: string[] = []

    renderScene: RBXRendererScene
    results?: THREE.Object3D[]
    instance?: Instance

    constructor(renderScene: RBXRendererScene) {
        super()
        this.renderScene = renderScene
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isSame(_other: RenderDesc): boolean {
        throw new Error("Virtual method isSame called")
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    needsRegeneration(_other: RenderDesc): boolean {
        throw new Error("Virtual method needsRegeneration called")
    }

    fromRenderDesc(other: RenderDesc) {
        if (this.needsRegeneration(other)) {
            throw new Error("These RenderableDesc objects have differences that require recompilation")
        }

        this.virtualFromRenderDesc(other)
    }

    transferFrom(other: RenderDesc) {
        this.virtualTransferFrom(other)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    virtualTransferFrom(_other: RenderDesc) {
        //things that should be transferred after recompilation should be here (for example individual particles in emitters)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    virtualFromRenderDesc(_other: RenderDesc) {
        //everything that doesnt require compilation should be here
        throw new Error("Virtual method virtualFromRenderDesc called")
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fromInstance(_child: Instance) {
        throw new Error("Virtual method fromInstance called")
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async compileResults(_renderer: THREE.WebGLRenderer, _scene: THREE.Scene): Promise<THREE.Object3D[] | Response | undefined> {
        throw new Error("Virtual method compileResults called")
    }

    updateResults() {
        throw new Error("Virtual method updateResults called")
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static shouldRenderInstance(_instance: Instance) {
        return true
    }

    static register() {
        for (const classType of this.classTypes) {
            RenderDescClassTypes.set(classType, this)
        }
    }

    static() {
        return this.constructor as typeof RenderDesc
    }
}