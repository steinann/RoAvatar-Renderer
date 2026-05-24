import * as THREE from 'three';
import { EffectComposer, OrbitControls, OutputPass, RenderPass, UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { deg, download, rad, saveByteArray } from '../misc/misc';
import type { RenderDesc } from './renderDesc';
import { ObjectDesc } from './objectDesc';
import { CFrame, type Connection, type Instance } from '../rblx/rbx';
import { API, createContentMap, type Authentication } from '../api';
import { EmitterGroupDescClassTypes, ObjectDescClassTypes } from '../rblx/constant';
import { GLTFExporter } from 'three/examples/jsm/Addons.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { EmitterGroupDesc } from './emitterGroupDesc';
import { FLAGS } from '../misc/flags';
import type { Vec3 } from '../mesh/mesh';
import { loadCompositMeshes } from './textureComposer';
import { setupWorkerPool } from '../misc/worker-pool';
import { RegisterWrappers } from '../rblx/wrapper-register';
import { error, log, warn } from '../misc/logger';

export function disposeMesh(scene: THREE.Scene, mesh: THREE.Mesh) {
    if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        for (const material of materials) {
            for (const key of Object.keys(material)) {
                const value = (material as unknown as {[K in string]: unknown})[key]
                if (value instanceof THREE.Texture) {
                    value.dispose()
                }
            }

            if (material instanceof THREE.ShaderMaterial) {
                const uniforms = material.uniforms
                for (const key of Object.keys(uniforms)) {
                    const value = uniforms[key].value
                    if (value instanceof THREE.Texture) {
                        value.dispose()
                    }
                }
            }
            
            material.dispose()
        }
    }
    if (mesh.geometry) {
        mesh.geometry.dispose()
    }
    scene.remove(mesh)
}

/**
 * Created by calling RBXRenderer.addScene()
 * @category Renderer
 */
export class RBXRendererScene {
    //important scene components
    scene: THREE.Scene = new THREE.Scene()
    camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera( 70, 1 / 1, 0.1, 100 )
    controls: OrbitControls | undefined

    shouldAnimate: boolean = true
    destroyed: boolean = false

    //renderer
    effectComposer: EffectComposer | undefined

    //viewport
    scissor?: [number, number, number, number]
    viewport?: [number, number, number, number]

    //renderables data
    isRenderingMesh: Map<Instance,boolean> = new Map()
    renderDescs: Map<Instance,RenderDesc> = new Map()
    destroyConnections: Map<Instance,Connection> = new Map()

    //scene appearance config
    lookAwayVector: Vec3 = [0.406, 0.306, -0.819]
    lookAwayDistance: number = 6

    shadowEnabled: boolean = true
    shadowResolution: [number, number] = [256, 256]
    _wellLitDirectionalLightIntensity: number = Math.PI / 2

    set wellLitDirectionalLightIntensity(v: number) {
        this._wellLitDirectionalLightIntensity = v
        if (this.directionalLight) {
            this.directionalLight.intensity = this._wellLitDirectionalLightIntensity
        }
    }

    get wellLitDirectionalLightIntensity() {
        return this._wellLitDirectionalLightIntensity
    }

    //scene appearance
    plane?: THREE.Mesh
    shadowPlane?: THREE.Mesh
    ambientLight?: THREE.AmbientLight
    directionalLight?: THREE.DirectionalLight
    directionalLight2?: THREE.DirectionalLight

    /** Forces viewport to be within bounds */
    setRect(bounds: DOMRect) {
        this.viewport = [bounds.left, window.innerHeight - bounds.bottom, bounds.width, bounds.height]
        this.scissor = [...this.viewport]
    }

    /** Makes viewport size 0x0, invisible */
    noRect() {
        this.viewport = [0,0,0,0]
        this.scissor = [0,0,0,0]
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true

        for (const instance of this.renderDescs.keys()) {
            RBXRenderer.removeInstance(instance, this)
        }

        RBXRenderer.scenes.splice(RBXRenderer.scenes.indexOf(this), 1)

        if (this.plane) {
            disposeMesh(this.scene, this.plane)
            this.plane = undefined
        }
        if (this.shadowPlane) {
            disposeMesh(this.scene, this.shadowPlane)
            this.shadowPlane = undefined
        }
    }

    async exportGLTF(name: string = "scene", autoDownload: boolean = true): Promise<ArrayBuffer | {[key: string]: unknown}> {
        return new Promise((resolve, reject) => {
            const exporter = new GLTFExporter()
            exporter.parse(this.scene, (gltf) => {
                if (autoDownload) {
                    if (gltf instanceof ArrayBuffer) {
                        saveByteArray([gltf], `${name}.glb`)
                    } else {
                        download(`${name}.gltf`,JSON.stringify(gltf))
                    }
                }

                resolve(gltf)
            }, (error) => {
                reject(error)
            })
        })
    }
}

/**
 * A singleton, intialized by calling RBXRenderer.fullSetup()
 * 
 * @category Renderer
 */
export class RBXRenderer {
    static orbitControlsTarget: Vec3 = [0,3,0]

    static scenes: RBXRendererScene[] = [new RBXRendererScene()]
    
    static get firstScene() {
        return RBXRenderer.scenes[0]
    }

    /**@deprecated This can only get the first renderScene's scene */
    static get scene() {
        return RBXRenderer.firstScene.scene
    }
    /**@deprecated This can only get the first renderScene's camera */
    static get camera() {
        return RBXRenderer.firstScene.camera
    }
    /**@deprecated This can only get the first renderScene's controls */
    static get controls() {
        return RBXRenderer.firstScene.controls
    }

    static renderer?: THREE.WebGLRenderer

    static resolution: [number,number] = [420, 420]

    static backgroundColorHex: number = 0x2b2d33
    static backgroundTransparent: boolean = false

    static createLoadingIcon: boolean = true
    static canvasContainer: HTMLDivElement
    static loadingIcon?: HTMLSpanElement
    static loadingIconStyle?: HTMLStyleElement

    /**@deprecated This can only get the first renderScene's plane */
    static get plane() {return RBXRenderer.firstScene.plane}
    /**@deprecated This can only get the first renderScene's shadowPlane */
    static get shadowPlane() {return RBXRenderer.firstScene.shadowPlane}
    /**@deprecated This can only get the first renderScene's ambientLight */
    static get ambientLight() {return RBXRenderer.firstScene.ambientLight}
    /**@deprecated This can only get the first renderScene's directionalLight */
    static get directionalLight() {return RBXRenderer.firstScene.directionalLight}
    /**@deprecated This can only get the first renderScene's directionalLight2 */
    static get directionalLight2() {return RBXRenderer.firstScene.directionalLight2}
    /**@deprecated This can only set the first renderScene's wellLitDirectionalLightIntensity*/
    static set wellLitDirectionalLightIntensity(v: number) {
        RBXRenderer.firstScene.wellLitDirectionalLightIntensity = v
    }
    /**@deprecated This can only gey the first renderScene's wellLitDirectionalLightIntensity*/
    static get wellLitDirectionalLightIntensity() {
        return RBXRenderer.firstScene.wellLitDirectionalLightIntensity
    }

    static failedToCreate: boolean = false
    static error?: unknown

    static async boilerplateSetup() {
        RegisterWrappers()
        createContentMap()
        setupWorkerPool()
        loadCompositMeshes()
    }

    static async showErrorHTML() {
        log(true, "Displaying WebGL2 error in canvasContainer...")

        const errorDiv = document.createElement("div")
        errorDiv.style = `
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        background-color: rgb(255, 89, 89);
        `

        const errorTitle = document.createElement("span")
        errorTitle.style = `
        font-family: Arial, Helvetica, sans-serif;
        font-size: 48px;
        color: #fff;
        margin-top: 8px;
        text-align: center;
        `
        errorTitle.innerText = "No WebGL2?"
        errorDiv.appendChild(errorTitle)

        const errorText = document.createElement("span")
        errorText.style = `
        font-family: Arial, Helvetica, sans-serif;
        font-size: 24px;
        color: #fff;
        text-align: center;
        max-width: 90%;
        `
        errorText.innerText = "Your browser, device or settings do not support WebGL2"
        errorDiv.appendChild(errorText)

        const errorLink = document.createElement("a")
        errorLink.style = `
        font-family: Arial, Helvetica, sans-serif;
        font-size: 24px;
        color: #fff;
        text-align: center;
        `
        errorLink.target = "_blank"
        errorLink.innerText = "Learn more"
        errorLink.href = "https://webglreport.com/?v=2"
        errorDiv.appendChild(errorLink)
        
        RBXRenderer.canvasContainer.append(errorDiv)
    }

    static createLoadingIconHTML() {
        //actual icon
        RBXRenderer.loadingIcon = document.createElement("span")
        RBXRenderer.loadingIcon.className = "roavatar-loader"
        RBXRenderer.loadingIcon.style.opacity = "0"
        RBXRenderer.loadingIcon.style.position = "absolute"
        RBXRenderer.loadingIcon.style.bottom = "12px"
        RBXRenderer.loadingIcon.style.right = "12px"
        RBXRenderer.loadingIcon.style.width = "24px"
        RBXRenderer.loadingIcon.style.height = "24px"
        RBXRenderer.loadingIcon.style.transition = "0.1s"
        RBXRenderer.loadingIcon.style.transitionProperty = "opacity"

        //icon style
        RBXRenderer.loadingIconStyle = document.createElement("style")
        RBXRenderer.loadingIconStyle.textContent = `
            /*Loader source: https://cssloaders.github.io/ */
            .roavatar-loader {
            width: 48px;
            height: 48px;
            display: inline-block;
            position: relative;
            background: #FFF;
            box-sizing: border-box;
            animation: rooavatarFlipX 1s linear infinite;
            }

            @keyframes rooavatarFlipX {
            0% {
                transform: perspective(200px) rotateX(0deg) rotateY(0deg);
            }
            50% {
                transform: perspective(200px) rotateX(-180deg) rotateY(0deg);
            }
            100% {
                transform: perspective(200px) rotateX(-180deg) rotateY(-180deg);
            }
            }
        `

        //add to proper parents
        document.head.appendChild(RBXRenderer.loadingIconStyle)
        RBXRenderer.canvasContainer.appendChild(RBXRenderer.loadingIcon)

        //loading event listener
        const onLoadConnection = API.Events.OnLoadingAssets.Connect((newIsLoading) => {
            if (RBXRenderer.loadingIcon) {
                RBXRenderer.loadingIcon.style.opacity = newIsLoading ? "1" : "0"
            } else {
                onLoadConnection.Disconnect()
            }
        })
    }

    static addScene(): RBXRendererScene {
        const renderScene = new RBXRendererScene()
        RBXRenderer.scenes.push(renderScene)
        return renderScene
    }

    /**Fully sets up renderer with scene, camera and frame rendering
     * @returns success
    */
    static async fullSetup(includeSceneAppearance: boolean = true, includeControls: boolean = true, includeAnimate: boolean = true): Promise<boolean> {
        try {
            RBXRenderer.createContainer()
            await RBXRenderer.boilerplateSetup()
            RBXRenderer.create()
            if (includeSceneAppearance) RBXRenderer.setupScene()
            if (includeControls) RBXRenderer.setupControls()
            if (includeAnimate) RBXRenderer.animateAll()
        } catch (err) {
            error(err)
            RBXRenderer.failedToCreate = true
            RBXRenderer.error = err
            RBXRenderer.showErrorHTML()
        }

        return !RBXRenderer.failedToCreate
    }

    /**Creates canvasContainer */
    static createContainer() {
        //create container
        RBXRenderer.canvasContainer = document.createElement("div")
        RBXRenderer.canvasContainer.style.position = "relative"
        RBXRenderer.canvasContainer.style.width = `${RBXRenderer.resolution[0]}px`
        RBXRenderer.canvasContainer.style.height = `${RBXRenderer.resolution[1]}px`
    }

    /**Sets up the THREE.js renderer */
    static create(canvas?: HTMLCanvasElement) {
        //create renderer
        RBXRenderer.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, canvas})
        RBXRenderer.renderer.setClearColor(new THREE.Color(1,0,1), 0)

        RBXRenderer.renderer.outputColorSpace = THREE.SRGBColorSpace
        RBXRenderer.renderer.shadowMap.enabled = true
        RBXRenderer.renderer.shadowMap.type = THREE.PCFSoftShadowMap

        RBXRenderer.renderer.setPixelRatio(globalThis.devicePixelRatio * 1 || 1)
        RBXRenderer.renderer.setSize(...RBXRenderer.resolution);

        if (FLAGS.USE_POST_PROCESSING && FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE) {
            RBXRenderer.renderer.setSize(RBXRenderer.resolution[0] * 2, RBXRenderer.resolution[1] * 2)
        }

        RBXRenderer.renderer.domElement.setAttribute("id","OutfitInfo-outfit-image-3d")

        //add renderDom
        RBXRenderer.canvasContainer.appendChild(RBXRenderer.renderer.domElement)

        if (RBXRenderer.createLoadingIcon && !RBXRenderer.loadingIcon) {
            RBXRenderer.createLoadingIconHTML()
        }

        if (FLAGS.USE_POST_PROCESSING) {
            RBXRenderer._createEffectComposer()
        }

        RBXRenderer.setupLostContextHandler()
    }

    static setupLostContextHandler() {
        if (!RBXRenderer.renderer) return
        RBXRenderer.renderer.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault()
            error(true, "RBXRenderer's WebGL2 context was lost, consider optimizing your WebGL usage")
            if (FLAGS.AUTO_RESTORE_CONTEXT) {
                //create new canvas
                const newCanvas = document.createElement("canvas")
                if (RBXRenderer.renderer?.domElement) {
                    RBXRenderer.canvasContainer.replaceChild(newCanvas, RBXRenderer.renderer.domElement)
                }

                //recreate renderer
                RBXRenderer.renderer?.dispose()
                RBXRenderer.create(newCanvas)

                //update renderers
                for (const renderScene of RBXRenderer.scenes) {
                    //restore controls
                    const controls = renderScene.controls
                    if (controls) {
                        controls.dispose()
                        controls.domElement = newCanvas
                        controls.connect(newCanvas)
                    }

                    //mark rendertarget instances as dirty
                    for (const renderDesc of renderScene.renderDescs.values()) {
                        if (renderDesc instanceof ObjectDesc) {
                            const materialDesc = renderDesc.materialDesc
                            const composeType = materialDesc.getComposeType("color")

                            if (composeType === "full" || composeType === "simple") {
                                materialDesc.dirty = true
                            }
                        }
                    }
                }
            }
        })

        /*RBXRenderer.renderer.domElement.addEventListener("webglcontextrestored", () => {
            log(true, "RBXRenderer's WebGL2 context is being restored...")

            for (const renderScene of RBXRenderer.scenes) {
                const threeScene = renderScene.scene

                threeScene.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                        obj.geometry.attributes.position.needsUpdate = true
                        if (obj.material.map) obj.material.map.needsUpdate = true
                        obj.material.needsUpdate = true
                    }
                })
            }
        })*/
    }

    /**Sets up a basic scene with lighting
     * @param lightingType "WellLit" is the default lighting for RoAvatar, "Thumbnail" tries to match the Roblox thumbnail lighting
     * @param backgroundColorHex is the hex code for the background color, for example 0x2b2d33
    */
    static setupScene(lightingType: "WellLit" | "Thumbnail" = "WellLit", backgroundColorHex = RBXRenderer.backgroundColorHex, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        //const backgroundColor = new THREE.Color( 0x2C2E31 )
        //const backgroundColor = new THREE.Color( 0x191a1f )
        //const backgroundColor = new THREE.Color( 0x2a2a2d )
        RBXRenderer.backgroundColorHex = backgroundColorHex

        const backgroundColor = new THREE.Color( backgroundColorHex )
        renderScene.scene.background = backgroundColor;

        let thumbnailAmbientVal = 138 //138 SHOULD be accurate but its not???, nvm it probably is but there is a second light source, wait i think ambient is more correct to use
        thumbnailAmbientVal = 128
        //thumbnailAmbientVal = 153 //this is 255 * 0.6
        let ambientLightColor = undefined
        if (lightingType === "Thumbnail") {
            ambientLightColor = new THREE.Color(thumbnailAmbientVal / 255, thumbnailAmbientVal / 255, thumbnailAmbientVal / 255)
        } else if (lightingType === "WellLit") {
            ambientLightColor = new THREE.Color(100 / 255, 100 / 255, 100 / 255)
        }
        //const ambientLight = new THREE.AmbientLight( 0x7a7a7a );
        const ambientLight = new THREE.AmbientLight( ambientLightColor, Math.PI / 2 );
        renderScene.scene.add( ambientLight );
        renderScene.ambientLight = ambientLight

        let directionalLightColor = undefined
        const directionalLightVal = 0.7 * 0.9 * 2 * 0.4
        if (lightingType === "Thumbnail") {
            directionalLightColor = new THREE.Color(directionalLightVal, directionalLightVal, directionalLightVal)
        } else if (lightingType === "WellLit") {
            directionalLightColor = new THREE.Color(1,1,1)
        }
        let directionalLightIntensity = 1
        if (lightingType === "WellLit") {
            directionalLightIntensity = renderScene._wellLitDirectionalLightIntensity
        }

        const directionalLight = new THREE.DirectionalLight( directionalLightColor, directionalLightIntensity );
        //directionalLight.position.set(new THREE.Vector3(1.2,1,1.2))
        if (lightingType === "WellLit") {
            directionalLight.position.set(-5,15,-8)
        } else if (lightingType === "Thumbnail") {
            directionalLight.position.set(-0.47489210963249207 * 10, 0.8225368857383728 * 10, 0.3129066228866577 * 10)
        }

        if (lightingType === "WellLit") {
            directionalLight.castShadow = renderScene.shadowEnabled
        }
        directionalLight.shadow.mapSize.width = renderScene.shadowResolution[0];
        directionalLight.shadow.mapSize.height = renderScene.shadowResolution[1];

        const bottomOffset = 1.6
        const shadowPhysicalSize = 5
        directionalLight.shadow.camera.left = -shadowPhysicalSize
        directionalLight.shadow.camera.right = shadowPhysicalSize
        directionalLight.shadow.camera.top = shadowPhysicalSize + bottomOffset
        directionalLight.shadow.camera.bottom = -shadowPhysicalSize + bottomOffset

        directionalLight.shadow.camera.near = 0.5; // default
        directionalLight.shadow.camera.far = 25;

        directionalLight.shadow.intensity = 0.5

        //const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
        //scene.add(shadowHelper);

        directionalLight.target.position.set(0,0,0)
        renderScene.scene.add( directionalLight );
        renderScene.directionalLight = directionalLight

        if (lightingType === "WellLit") {
            const directionalLight2 = new THREE.DirectionalLight( 0xffffff, 0.3 );
            //directionalLight.position.set(new THREE.Vector3(1.2,1,1.2))
            directionalLight2.position.set(5,-7,5)
            directionalLight2.target.position.set(0,0,0)
            renderScene.scene.add( directionalLight2 );
            renderScene.directionalLight2 = directionalLight2
        } else if (lightingType === "Thumbnail") { //this looks good TODO: disable specular from this light somehow, should exclusively be diffuse
            const directionalLight2 = new THREE.DirectionalLight( directionalLightColor, directionalLightIntensity * 0.5 );
            //directionalLight.position.set(new THREE.Vector3(1.2,1,1.2))
            directionalLight2.position.set(-0.47489210963249207 * -10, 0.8225368857383728 * -10, 0.3129066228866577 * -10)
            directionalLight2.target.position.set(0,0,0)
            renderScene.scene.add( directionalLight2 );
            renderScene.directionalLight2 = directionalLight2
        }

        const planeGeometry = new THREE.PlaneGeometry( 100, 100, 1, 1 );
        const planeShadowMaterial = new THREE.ShadowMaterial({opacity: 1.0});
        const shadowPlane = new THREE.Mesh( planeGeometry, planeShadowMaterial );
        shadowPlane.rotation.set(rad(-90),0,0)
        shadowPlane.position.set(0,0,0)
        shadowPlane.receiveShadow = true;
        renderScene.shadowPlane = shadowPlane
        renderScene.scene.add( shadowPlane );

        const planeSolidColorMaterial = new THREE.MeshBasicMaterial({color: backgroundColor})
        const plane = new THREE.Mesh( planeGeometry, planeSolidColorMaterial );
        plane.rotation.set(rad(-90),0,0)
        plane.position.set(0,0,0)
        plane.receiveShadow = false;
        renderScene.plane = plane
        renderScene.scene.add( plane );
    }

    /**Sets up orbit controls */
    static setupControls(renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        if (!RBXRenderer.renderer) return
        //orbit controls
        const controls = new OrbitControls(renderScene.camera, RBXRenderer.renderer.domElement)
        controls.maxDistance = 25
        controls.zoomSpeed = 2

        controls.target.set(...RBXRenderer.orbitControlsTarget)
        log(false, controls.target)

        renderScene.controls = controls
        renderScene.camera.position.set(renderScene.lookAwayVector[0] * renderScene.lookAwayDistance,3 + renderScene.lookAwayVector[1] * renderScene.lookAwayDistance,renderScene.lookAwayVector[2] * renderScene.lookAwayDistance)
        renderScene.camera.lookAt(new THREE.Vector3(...RBXRenderer.orbitControlsTarget))
        controls.update()
    }

    /**
     * @param colorHex example: 0x2b2d33 which is the default
     */
    static setBackgroundColor(colorHex: number) {
        RBXRenderer.backgroundColorHex = colorHex
        for (const renderScene of RBXRenderer.scenes) {
            if (RBXRenderer.backgroundTransparent) {
                renderScene.scene.background = null
            } else {
                renderScene.scene.background = new THREE.Color( RBXRenderer.backgroundColorHex )
            }
            if (renderScene.plane) {
                renderScene.plane.visible = !RBXRenderer.backgroundTransparent
            }
            if (renderScene.plane) {
                renderScene.plane.material = new THREE.MeshBasicMaterial({color: colorHex})
            }
        }
    }

    /**
     * Sets the background and ground's visibility, but not the shadowPlane
     * @param transparent If the background and ground should be transparent
     */
    static setBackgroundTransparent(transparent: boolean) {
        RBXRenderer.backgroundTransparent = transparent
        for (const renderScene of RBXRenderer.scenes) {
            if (RBXRenderer.backgroundTransparent) {
                renderScene.scene.background = null
            } else {
                renderScene.scene.background = new THREE.Color( RBXRenderer.backgroundColorHex )
            }
            if (renderScene.plane) {
                renderScene.plane.visible = !RBXRenderer.backgroundTransparent
            }
        }
    }

    /**@deprecated Makes the renderer render a new frame on every animationFrame */
    static animate(shouldRequestAnimationFrame: boolean = true) {
        if (!RBXRenderer.renderer) return
        RBXRenderer.renderScene(RBXRenderer.firstScene)

        if (shouldRequestAnimationFrame) {
            requestAnimationFrame( () => {
                RBXRenderer.animate()
            } );
        }
    }

    static animateAll(shouldRequestAnimationFrame: boolean = true) {
        if (!RBXRenderer.renderer) return
        for (const renderScene of RBXRenderer.scenes) {
            RBXRenderer.renderScene(renderScene, renderScene === RBXRenderer.firstScene)
        }

        if (shouldRequestAnimationFrame) {
            requestAnimationFrame(() => {
                RBXRenderer.animateAll()
            })
        }
    }

    static renderScene(renderScene: RBXRendererScene, autoClear: boolean = true) {
        if (!RBXRenderer.renderer) return
        if (!renderScene.shouldAnimate) return
        RBXRenderer.renderer.autoClear = autoClear
        if (!autoClear) {
            RBXRenderer.renderer.clearDepth()
        }
        RBXRenderer.renderer.setRenderTarget(null)

        //fix viewport and scissor
        let [x, y] = [0,0]
        let [width, height] = RBXRenderer.resolution
        if (renderScene.viewport) {
            x = renderScene.viewport[0]
            y = renderScene.viewport[1]
            width = renderScene.viewport[2]
            height = renderScene.viewport[3]
        }

        RBXRenderer.renderer.setViewport(x, y, width, height)

        if (renderScene.scissor) {
            RBXRenderer.renderer.setScissorTest(true)
            RBXRenderer.renderer.setScissor(...renderScene.scissor)
        } else {
            RBXRenderer.renderer.setScissorTest(false)
        }

        renderScene.camera.aspect = width / height
        renderScene.camera.updateProjectionMatrix()

        //actually render
        if (width > 0 && height > 0) {
            if (renderScene.effectComposer) {
                renderScene.effectComposer.render();
            } else {
                RBXRenderer.renderer.render(renderScene.scene, renderScene.camera)
            }
        }

        RBXRenderer.renderer.autoClear = true
    }

    static _createEffectComposer(renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        if (!RBXRenderer.renderer) return
        renderScene.effectComposer = new EffectComposer(RBXRenderer.renderer)
        const renderPass = new RenderPass(renderScene.scene, renderScene.camera)
        renderScene.effectComposer.addPass(renderPass)

        const resolution = new THREE.Vector2(420, 420)
        const bloomPass = new UnrealBloomPass(resolution, 0.15, 0.0001, 0.9)
        renderScene.effectComposer.addPass(bloomPass)

        if (!FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE) {
            const fxaaPass = new FXAAPass()
            renderScene.effectComposer.addPass(fxaaPass)
        }

        const outputPass = new OutputPass()
        renderScene.effectComposer.addPass(outputPass)
    }

    /**Removes an instance from the renderer */
    static removeInstance(instance: Instance, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        if (!RBXRenderer.renderer) return
        //console.log("Removed instance:", instance.Prop("Name"), instance.id)

        const desc = renderScene.renderDescs.get(instance)
        if (desc) {
            desc.dispose(RBXRenderer.renderer, renderScene.scene)
        }

        renderScene.renderDescs.delete(instance)
        renderScene.isRenderingMesh.delete(instance)

        for (const child of instance.GetChildren()) {
            RBXRenderer.removeInstance(child, renderScene)
        }
    }

    static _addRenderDesc(instance: Instance, auth: Authentication, DescClass: typeof RenderDesc, renderScene: RBXRendererScene) {
        if (!RBXRenderer.renderer) return
        const oldDesc = renderScene.renderDescs.get(instance)
        const newDesc = new DescClass(renderScene)
        newDesc.fromInstance(instance)

        if (oldDesc && !oldDesc.needsRegeneration(newDesc)) {
            //do nothing except update
            //console.log(`Updating ${instance.Prop("Name")}`)
            if (!oldDesc.isSame(newDesc)) {
                oldDesc.fromRenderDesc(newDesc)
                oldDesc.updateResults()
            }
        } else {
            //generate new mesh
            if (!renderScene.isRenderingMesh.get(instance)) {
                //console.log(`Generating ${instance.Prop("Name")} ${instance.id}`)

                if (oldDesc) newDesc.transferFrom(oldDesc)
                newDesc.results = oldDesc?.results //this is done so that the result can be disposed if a removeInstance is called during generation
                renderScene.renderDescs.set(instance, newDesc)
                renderScene.isRenderingMesh.set(instance, true)

                //get the mesh
                newDesc.compileResults(RBXRenderer.renderer, renderScene.scene).then(results => {
                    if (results && !(results instanceof Response)) {
                        newDesc.updateResults()

                        if (renderScene.renderDescs.get(instance) && RBXRenderer.renderer) {
                            oldDesc?.dispose(RBXRenderer.renderer, renderScene.scene)

                            for (const result of results) {
                                //update skeletonDesc for RenderDescs that have that
                                if (result instanceof THREE.SkinnedMesh && newDesc instanceof ObjectDesc) {
                                    const skeleton = newDesc.skeletonDesc?.skeleton
                                    
                                    if (skeleton) {
                                        result.bindMode = "detached"
                                        if (newDesc.skeletonDesc) {
                                            if (FLAGS.USE_LOCAL_SKELETONDESC) {
                                                result.add(newDesc.skeletonDesc.rootBone)
                                            } else {
                                                renderScene.scene.add(newDesc.skeletonDesc.rootBone)
                                            }
                                        }
                                        result.bind(skeleton)
                                        renderScene.scene.add(result)
                                    }
                                } else {
                                    renderScene.scene.add(result)
                                }
                            }

                            //console.log(`Generated ${instance.Prop("Name")} ${instance.id}`)

                            renderScene.isRenderingMesh.set(instance, false)
                            RBXRenderer.addInstance(instance, auth, renderScene) //check instance again in case it changed during compilation
                        } else if (RBXRenderer.renderer) {
                            newDesc.dispose(RBXRenderer.renderer, renderScene.scene)
                        }
                    } else {
                        warn(false, "Failed to compile mesh", this, results)
                    }
                })
            }
        }

        if (!renderScene.destroyConnections.get(instance)) {
            renderScene.destroyConnections.set(instance, instance.Destroying.Connect(() => {
                RBXRenderer.removeInstance(instance, renderScene)
                const connection = renderScene.destroyConnections.get(instance)
                connection?.Disconnect()
                renderScene.destroyConnections.delete(instance)
            }))
        }
    }

    /**Adds an instance to the renderer or updates it */
    static addInstance(instance: Instance, auth: Authentication, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        if (renderScene.destroyed) return

        //check that this decal isnt baked and should get its own ObjectDesc
        const isDecal = instance.className === "Decal"
        const isBakedDecal = isDecal && !instance.FindFirstChildOfClass("WrapTextureTransfer")
        let isFirstDecal = true
        if (isDecal && instance.parent) {
            const children = instance.parent.GetChildren()
            for (const child of children) {
                if (child.className === "Decal" && child.FindFirstChildOfClass("WrapTextureTransfer") && child.id < instance.id) {
                    isFirstDecal = false
                }
            }
        }

        //ObjectDesc
        if (ObjectDescClassTypes.includes(instance.className) && !isBakedDecal && (!isDecal || isFirstDecal)) {
            RBXRenderer._addRenderDesc(instance, auth, ObjectDesc, renderScene)
        }
        //EmitterGroupDesc
        else if (EmitterGroupDescClassTypes.includes(instance.className)) {
            RBXRenderer._addRenderDesc(instance, auth, EmitterGroupDesc, renderScene)
        }

        //update children  too
        for (const child of instance.GetChildren()) {
            RBXRenderer.addInstance(child, auth, renderScene)
        }
    }

    static setRendererSize(width: number, height: number) {
        if (!RBXRenderer.renderer) return
        RBXRenderer.resolution = [width, height]
        RBXRenderer.renderer.domElement.setAttribute("style",`width: ${RBXRenderer.resolution[0]}px; height: ${RBXRenderer.resolution[1]}px; border-radius: 0px;`)
        RBXRenderer.canvasContainer.style.width = `${RBXRenderer.resolution[0]}px`
        RBXRenderer.canvasContainer.style.height = `${RBXRenderer.resolution[1]}px`
        RBXRenderer.renderer.setSize(width, height)
        if (FLAGS.USE_POST_PROCESSING && FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE) {
            RBXRenderer.renderer.setSize(RBXRenderer.resolution[0] * 2, RBXRenderer.resolution[1] * 2)
        }
    }

    /**
     * @deprecated Use getRendererElement instead which includes the loading icon
     * @returns The element for the renderer canvas
     */
    static getRendererDom(): HTMLCanvasElement | undefined {
        if (!RBXRenderer.renderer) return
        return RBXRenderer.renderer.domElement
    }

    /**
     * @returns An element containing the renderer canvas
     */
    static getRendererElement(): HTMLDivElement {
        return RBXRenderer.canvasContainer
    }

    /**@deprecated This can only get the first renderScene's camera */
    static getRendererCamera(): THREE.PerspectiveCamera {
        return RBXRenderer.camera
    }

    static getCameraCFrame(renderScene: RBXRendererScene = RBXRenderer.firstScene): CFrame {
        const camera = renderScene.camera
        const pos = camera.position
        let rot = camera.rotation.clone()
        rot = rot.reorder("YXZ")

        const cf = new CFrame()
        cf.Position = pos.toArray()
        cf.Orientation = [deg(rot.x), deg(rot.y), deg(rot.z)]
        return cf
    }

    static setCameraCFrame(cameraCF: CFrame, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        const camPos = new THREE.Vector3()
        const camQuat = new THREE.Quaternion()
        const camScale = new THREE.Vector3()

        const camMatrix = cameraCF.getTHREEMatrix()
        camMatrix.decompose(camPos, camQuat, camScale)

        renderScene.camera.position.set(...camPos.toArray())
        renderScene.camera.quaternion.set(...camQuat.toArray())

        renderScene.camera.updateMatrixWorld()
    }

    static setCameraFov(fov: number, renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        renderScene.camera.fov = fov
    }

    /**@deprecated This can only get the first renderScene's controls */
    static getRendererControls(): OrbitControls | undefined {
        return RBXRenderer.controls
    }

    static getRenderer(): THREE.WebGLRenderer | undefined {
        return RBXRenderer.renderer
    }

    /**@deprecated This can only get the first renderScene's scene */
    static getScene() {
        return RBXRenderer.scene
    }

    /**@deprecated
     * This function is unstable and can throw errors, but might work
     */
    static exportScene(renderScene: RBXRendererScene = RBXRenderer.firstScene) {
        const exporter = new GLTFExporter()
        exporter.parse(renderScene.scene, (gltf) => {
            if (gltf instanceof ArrayBuffer) {
                saveByteArray([gltf], "scene.glb")
            } else {
                download("scene.gltf",JSON.stringify(gltf))
            }
        }, (error) => {
            throw error
        })
    }
}

/**
 * @deprecated Use mountElement instead
 * @param container 
 */
export function mount( container: HTMLDivElement ) {
    if (!RBXRenderer.renderer) return
    if (container) {
        container.insertBefore(RBXRenderer.renderer.domElement, container.firstChild)
    } else {
        RBXRenderer.renderer.domElement.remove()
    }
}

export function mountElement( container: HTMLDivElement ) {
    if (container) {
        container.insertBefore(RBXRenderer.canvasContainer, container.firstChild)
    } else {
        RBXRenderer.canvasContainer.remove()
    }
}