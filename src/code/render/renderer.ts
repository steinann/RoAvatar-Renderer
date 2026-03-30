import * as THREE from 'three';
import { EffectComposer, OrbitControls, OutputPass, RenderPass, UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { download, rad, saveByteArray } from '../misc/misc';
import type { RenderDesc } from './renderDesc';
import { ObjectDesc } from './objectDesc';
import { type Connection, type Instance } from '../rblx/rbx';
import { API, type Authentication } from '../api';
import { EmitterGroupDescClassTypes, ObjectDescClassTypes } from '../rblx/constant';
import { GLTFExporter } from 'three/examples/jsm/Addons.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { EmitterGroupDesc } from './emitterGroupDesc';
import { FLAGS } from '../misc/flags';
import type { Vec3 } from '../mesh/mesh';
import { loadCompositMeshes } from './textureComposer';
import { setupWorkerPool } from '../misc/worker-pool';
import { RegisterWrappers } from '../rblx/wrapper-register';

export class RBXRenderer {
    static isRenderingMesh: Map<Instance,boolean> = new Map()
    static renderDescs: Map<Instance,RenderDesc> = new Map()
    static destroyConnections: Map<Instance,Connection> = new Map()

    static lookAwayVector: Vec3 = [0.406, 0.306, -0.819]
    static lookAwayDistance: number = 6

    static orbitControlsTarget: Vec3 = [0,3,0]

    static scene: THREE.Scene = new THREE.Scene()
    static camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera( 70, 1 / 1, 0.1, 100 );
    static controls: OrbitControls | undefined

    static renderer?: THREE.WebGLRenderer
    static effectComposer: EffectComposer | undefined

    static shadowEnabled: boolean = true
    static shadowResolution: [number, number] = [256, 256]
    static resolution: [number,number] = [420, 420]
    static backgroundColorHex: number = 0x2b2d33
    static backgroundTransparent: boolean = false
    static _wellLitDirectionalLightIntensity: number = Math.PI / 2

    static set wellLitDirectionalLightIntensity(v: number) {
        RBXRenderer._wellLitDirectionalLightIntensity = v
        if (RBXRenderer.directionalLight) {
            RBXRenderer.directionalLight.intensity = RBXRenderer._wellLitDirectionalLightIntensity
        }
    }

    static get wellLitDirectionalLightIntensity() {
        return RBXRenderer._wellLitDirectionalLightIntensity
    }

    static createLoadingIcon: boolean = true
    static canvasContainer: HTMLDivElement
    static loadingIcon?: HTMLSpanElement
    static loadingIconStyle?: HTMLStyleElement

    static plane?: THREE.Mesh
    static shadowPlane?: THREE.Mesh
    static ambientLight?: THREE.AmbientLight
    static directionalLight?: THREE.DirectionalLight
    static directionalLight2?: THREE.DirectionalLight

    static failedToCreate: boolean = false
    static error?: unknown

    static async boilerplateSetup() {
        RegisterWrappers()
        setupWorkerPool()
        loadCompositMeshes()
    }

    static async showErrorHTML() {
        console.log("Displaying WebGL2 error in canvasContainer...")

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

    /**Fully sets up renderer with scene, camera and frame rendering
     * @returns success
    */
    static async fullSetup(includeScene: boolean = true, includeControls: boolean = true): Promise<boolean> {
        try {
            RBXRenderer.createContainer()
            await RBXRenderer.boilerplateSetup()
            RBXRenderer.create()
            if (includeScene) RBXRenderer.setupScene()
            if (includeControls) RBXRenderer.setupControls()
            RBXRenderer.animate()
        } catch (error) {
            console.error(error)
            RBXRenderer.failedToCreate = true
            RBXRenderer.error = error
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
    static create() {
        //create renderer
        RBXRenderer.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true})
        RBXRenderer.renderer.setClearColor(new THREE.Color(1,0,1), 0)

        RBXRenderer.renderer.outputColorSpace = THREE.SRGBColorSpace
        RBXRenderer.renderer.shadowMap.enabled = true
        RBXRenderer.renderer.shadowMap.type = THREE.PCFSoftShadowMap

        RBXRenderer.renderer.setPixelRatio(window.devicePixelRatio * 1)
        RBXRenderer.renderer.setSize(...RBXRenderer.resolution);

        if (FLAGS.USE_POST_PROCESSING && FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE) {
            RBXRenderer.renderer.setSize(RBXRenderer.resolution[0] * 2, RBXRenderer.resolution[1] * 2)
        }

        RBXRenderer.renderer.domElement.setAttribute("id","OutfitInfo-outfit-image-3d")

        //add renderDom
        RBXRenderer.canvasContainer.appendChild(RBXRenderer.renderer.domElement)

        if (RBXRenderer.createLoadingIcon) {
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

        if (FLAGS.USE_POST_PROCESSING) {
            RBXRenderer._createEffectComposer()
        }
    }

    /**Sets up a basic scene with lighting
     * @param lightingType "WellLit" is the default lighting for RoAvatar, "Thumbnail" tries to match the Roblox thumbnail lighting
     * @param backgroundColorHex is the hex code for the background color, for example 0x2b2d33
    */
    static setupScene(lightingType: "WellLit" | "Thumbnail" = "WellLit", backgroundColorHex = RBXRenderer.backgroundColorHex) {
        //const backgroundColor = new THREE.Color( 0x2C2E31 )
        //const backgroundColor = new THREE.Color( 0x191a1f )
        //const backgroundColor = new THREE.Color( 0x2a2a2d )
        RBXRenderer.backgroundColorHex = backgroundColorHex

        const backgroundColor = new THREE.Color( backgroundColorHex )
        RBXRenderer.scene.background = backgroundColor;

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
        RBXRenderer.scene.add( ambientLight );
        RBXRenderer.ambientLight = ambientLight

        let directionalLightColor = undefined
        const directionalLightVal = 0.7 * 0.9 * 2 * 0.4
        if (lightingType === "Thumbnail") {
            directionalLightColor = new THREE.Color(directionalLightVal, directionalLightVal, directionalLightVal)
        } else if (lightingType === "WellLit") {
            directionalLightColor = new THREE.Color(1,1,1)
        }
        let directionalLightIntensity = 1
        if (lightingType === "WellLit") {
            directionalLightIntensity = this._wellLitDirectionalLightIntensity
        }

        const directionalLight = new THREE.DirectionalLight( directionalLightColor, directionalLightIntensity );
        //directionalLight.position.set(new THREE.Vector3(1.2,1,1.2))
        if (lightingType === "WellLit") {
            directionalLight.position.set(-5,15,-8)
        } else if (lightingType === "Thumbnail") {
            directionalLight.position.set(-0.47489210963249207 * 10, 0.8225368857383728 * 10, 0.3129066228866577 * 10)
        }

        if (lightingType === "WellLit") {
            directionalLight.castShadow = RBXRenderer.shadowEnabled
        }
        directionalLight.shadow.mapSize.width = RBXRenderer.shadowResolution[0];
        directionalLight.shadow.mapSize.height = RBXRenderer.shadowResolution[1];

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
        RBXRenderer.scene.add( directionalLight );
        RBXRenderer.directionalLight = directionalLight

        if (lightingType === "WellLit") {
            const directionalLight2 = new THREE.DirectionalLight( 0xffffff, 0.3 );
            //directionalLight.position.set(new THREE.Vector3(1.2,1,1.2))
            directionalLight2.position.set(5,-7,5)
            directionalLight2.target.position.set(0,0,0)
            RBXRenderer.scene.add( directionalLight2 );
            RBXRenderer.directionalLight2 = directionalLight2
        } else if (lightingType === "Thumbnail") { //this looks good TODO: disable specular from this light somehow, should exclusively be diffuse
            const directionalLight2 = new THREE.DirectionalLight( directionalLightColor, directionalLightIntensity * 0.5 );
            //directionalLight.position.set(new THREE.Vector3(1.2,1,1.2))
            directionalLight2.position.set(-0.47489210963249207 * -10, 0.8225368857383728 * -10, 0.3129066228866577 * -10)
            directionalLight2.target.position.set(0,0,0)
            RBXRenderer.scene.add( directionalLight2 );
            RBXRenderer.directionalLight2 = directionalLight2
        }

        const planeGeometry = new THREE.PlaneGeometry( 100, 100, 1, 1 );
        const planeShadowMaterial = new THREE.ShadowMaterial({opacity: 1.0});
        const shadowPlane = new THREE.Mesh( planeGeometry, planeShadowMaterial );
        shadowPlane.rotation.set(rad(-90),0,0)
        shadowPlane.position.set(0,0,0)
        shadowPlane.receiveShadow = true;
        RBXRenderer.shadowPlane = shadowPlane
        RBXRenderer.scene.add( shadowPlane );

        const planeSolidColorMaterial = new THREE.MeshBasicMaterial({color: backgroundColor})
        const plane = new THREE.Mesh( planeGeometry, planeSolidColorMaterial );
        plane.rotation.set(rad(-90),0,0)
        plane.position.set(0,0,0)
        plane.receiveShadow = false;
        RBXRenderer.plane = plane
        RBXRenderer.scene.add( plane );
    }

    /**Sets up orbit controls */
    static setupControls() {
        if (!RBXRenderer.renderer) return
        //orbit controls
        const controls = new OrbitControls(RBXRenderer.camera, RBXRenderer.renderer.domElement)
        controls.maxDistance = 25
        controls.zoomSpeed = 2

        controls.target.set(...RBXRenderer.orbitControlsTarget)
        console.log(controls.target)

        RBXRenderer.controls = controls
        RBXRenderer.camera.position.set(RBXRenderer.lookAwayVector[0] * RBXRenderer.lookAwayDistance,3 + RBXRenderer.lookAwayVector[1] * RBXRenderer.lookAwayDistance,RBXRenderer.lookAwayVector[2] * RBXRenderer.lookAwayDistance)
        RBXRenderer.camera.lookAt(new THREE.Vector3(...RBXRenderer.orbitControlsTarget))
        controls.update()
    }

    /**
     * @param colorHex example: 0x2b2d33 which is the default
     */
    static setBackgroundColor(colorHex: number) {
        RBXRenderer.backgroundColorHex = colorHex
        if (RBXRenderer.backgroundTransparent) {
            RBXRenderer.scene.background = null
        } else {
            RBXRenderer.scene.background = new THREE.Color( RBXRenderer.backgroundColorHex )
        }
        if (RBXRenderer.plane) {
            RBXRenderer.plane.visible = !RBXRenderer.backgroundTransparent
        }
        if (RBXRenderer.plane) {
            RBXRenderer.plane.material = new THREE.MeshBasicMaterial({color: colorHex})
        }
    }

    /**
     * Sets the background and ground's visibility, but not the shadowPlane
     * @param transparent If the background and ground should be transparent
     */
    static setBackgroundTransparent(transparent: boolean) {
        RBXRenderer.backgroundTransparent = transparent
        if (RBXRenderer.backgroundTransparent) {
            RBXRenderer.scene.background = null
        } else {
            RBXRenderer.scene.background = new THREE.Color( RBXRenderer.backgroundColorHex )
        }
        if (RBXRenderer.plane) {
            RBXRenderer.plane.visible = !RBXRenderer.backgroundTransparent
        }
    }

    /**Makes the renderer render a new frame on every animationFrame */
    static animate() {
        if (!RBXRenderer.renderer) return
        RBXRenderer.renderer.setRenderTarget(null)
        if (RBXRenderer.effectComposer) {
            RBXRenderer.effectComposer.render();
        } else {
            RBXRenderer.renderer.render(RBXRenderer.scene, RBXRenderer.camera)
        }

        requestAnimationFrame( () => {
            RBXRenderer.animate()
        } );
    }

    static _createEffectComposer() {
        if (!RBXRenderer.renderer) return
        RBXRenderer.effectComposer = new EffectComposer(RBXRenderer.renderer)
        const renderPass = new RenderPass(RBXRenderer.scene, RBXRenderer.camera)
        RBXRenderer.effectComposer.addPass(renderPass)

        const resolution = new THREE.Vector2(420, 420)
        const bloomPass = new UnrealBloomPass(resolution, 0.15, 0.0001, 0.9)
        RBXRenderer.effectComposer.addPass(bloomPass)

        if (!FLAGS.POST_PROCESSING_IS_DOUBLE_SIZE) {
            const fxaaPass = new FXAAPass()
            RBXRenderer.effectComposer.addPass(fxaaPass)
        }

        const outputPass = new OutputPass()
        RBXRenderer.effectComposer.addPass(outputPass)
    }

    /**Removes an instance from the renderer */
    static removeInstance(instance: Instance) {
        if (!RBXRenderer.renderer) return
        //console.log("Removed instance:", instance.Prop("Name"), instance.id)

        const desc = RBXRenderer.renderDescs.get(instance)
        if (desc) {
            desc.dispose(RBXRenderer.renderer, RBXRenderer.scene)
        }

        RBXRenderer.renderDescs.delete(instance)
        RBXRenderer.isRenderingMesh.delete(instance)

        for (const child of instance.GetChildren()) {
            RBXRenderer.removeInstance(child)
        }
    }

    static _addRenderDesc(instance: Instance, auth: Authentication, DescClass: typeof RenderDesc) {
        if (!RBXRenderer.renderer) return
        const oldDesc = RBXRenderer.renderDescs.get(instance)
        const newDesc = new DescClass()
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
            if (!RBXRenderer.isRenderingMesh.get(instance)) {
                //console.log(`Generating ${instance.Prop("Name")} ${instance.id}`)

                newDesc.results = oldDesc?.results //this is done so that the result can be disposed if a removeInstance is called during generation
                RBXRenderer.renderDescs.set(instance, newDesc)
                RBXRenderer.isRenderingMesh.set(instance, true)

                //get the mesh
                newDesc.compileResults(RBXRenderer.renderer, RBXRenderer.scene).then(results => {
                    if (results && !(results instanceof Response)) {
                        newDesc.updateResults()

                        if (RBXRenderer.renderDescs.get(instance) && RBXRenderer.renderer) {
                            oldDesc?.dispose(RBXRenderer.renderer, RBXRenderer.scene)

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
                                                RBXRenderer.scene.add(newDesc.skeletonDesc.rootBone)
                                            }
                                        }
                                        result.bind(skeleton)
                                        RBXRenderer.scene.add(result)
                                    }
                                } else {
                                    RBXRenderer.scene.add(result)
                                }
                            }

                            //console.log(`Generated ${instance.Prop("Name")} ${instance.id}`)

                            RBXRenderer.isRenderingMesh.set(instance, false)
                            RBXRenderer.addInstance(instance, auth) //check instance again in case it changed during compilation
                        } else if (RBXRenderer.renderer) {
                            newDesc.dispose(RBXRenderer.renderer, RBXRenderer.scene)
                        }
                    } else {
                        console.warn("Failed to compile mesh", results)
                    }
                })
            }
        }

        if (!RBXRenderer.destroyConnections.get(instance)) {
            RBXRenderer.destroyConnections.set(instance, instance.Destroying.Connect(() => {
                RBXRenderer.removeInstance(instance)
                const connection = RBXRenderer.destroyConnections.get(instance)
                connection?.Disconnect()
                RBXRenderer.destroyConnections.delete(instance)
            }))
        }
    }

    /**Adds an instance to the renderer or updates it */
    static addInstance(instance: Instance, auth: Authentication) {
        //check that this decal isnt baked and should get its own ObjectDesc
        const isDecal = instance.className === "Decal"
        const isBakedDecal = isDecal && !instance.FindFirstChildOfClass("WrapTextureTransfer")
        let isFirstDecal = true
        if (isDecal && instance.parent) {
            const children = instance.GetChildren()
            for (const child of children) {
                if (child.className === "Decal" && child.FindFirstChildOfClass("WrapTextureTransfer") && child.id < instance.id) {
                    isFirstDecal = false
                }
            }
        }

        //ObjectDesc
        if (ObjectDescClassTypes.includes(instance.className) && !isBakedDecal && (!isDecal || isFirstDecal)) {
            RBXRenderer._addRenderDesc(instance, auth, ObjectDesc)
        }
        //EmitterGroupDesc
        else if (EmitterGroupDescClassTypes.includes(instance.className)) {
            RBXRenderer._addRenderDesc(instance, auth, EmitterGroupDesc)
        }

        //update children  too
        for (const child of instance.GetChildren()) {
            RBXRenderer.addInstance(child, auth)
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
        RBXRenderer.camera.aspect = width / height
        RBXRenderer.camera.updateProjectionMatrix()
    }

    /**
     * @deprecated Use getRendererElement instead which includes the loading icon
     * @returns The element for the renderer canvas
     */
    static getRendererDom() {
        if (!RBXRenderer.renderer) return
        return RBXRenderer.renderer.domElement
    }

    /**
     * @returns An element containing the renderer canvas
     */
    static getRendererElement() {
        return RBXRenderer.canvasContainer
    }

    static getRendererCamera() {
        return RBXRenderer.camera
    }

    static getRendererControls() {
        return RBXRenderer.controls
    }

    static getRenderer() {
        return RBXRenderer.renderer
    }

    static getScene() {
        return RBXRenderer.scene
    }

    /**@deprecated
     * This function is unstable and can throw errors, but might work
     */
    static exportScene() {
        const exporter = new GLTFExporter()
        exporter.parse(RBXRenderer.scene, (gltf) => {
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