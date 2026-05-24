import * as THREE from 'three'
import type { Instance } from "../rblx/rbx"
import { disposeMesh, type RBXRendererScene } from './renderer';

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
    renderScene: RBXRendererScene
    results?: THREE.Mesh[]
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

    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    virtualFromRenderDesc(_other: RenderDesc) {
        throw new Error("Virtual method virtualFromRenderDesc called")
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fromInstance(_child: Instance) {
        throw new Error("Virtual method fromInstance called")
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async compileResults(_renderer: THREE.WebGLRenderer, _scene: THREE.Scene): Promise<THREE.Mesh[] | Response | undefined> {
        throw new Error("Virtual method compileResults called")
    }

    updateResults() {
        throw new Error("Virtual method updateResults called")
    }
}