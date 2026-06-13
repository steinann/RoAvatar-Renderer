import { log } from "../../misc/logger";
import type { Instance } from "../rbx";

const ClassNameToWrapper = new Map<string, typeof InstanceWrapper>()

/**
 * @category InstanceWrapper
 */
export function GetWrapperForInstance(instance: Instance): InstanceWrapper | undefined {
    if (ClassNameToWrapper.size === 0) {
        throw new Error("RegisterWrappers need to be called before using RBX")
    }

    const staticWrapper = ClassNameToWrapper.get(instance.className)
    if (staticWrapper) {
        return new staticWrapper(instance)
    }
}

/**
 * Virtual class for all instance wrapper's
 * 
 * @category InstanceWrapper
 * @virtual
 */
export class InstanceWrapper {
    static className: string
    static requiredProperties: string[]

    instance: Instance

    constructor(instance: Instance) {
        this.instance = instance;

        if (this.instance.className !== this.static().className) {
            throw new Error(`Provided Instance is not a ${this.static().className}`)
        }

        if (this.instance.wrapperInitialized) return

        const propertyNames = this.instance.getPropertyNames()

        const hasAllProperties = this.static().requiredProperties.every(value => propertyNames.includes(value))
        if (!hasAllProperties) {
            this.setup()

            this.instance.wrapperInitialized = true

            const newPropertyNames = this.instance.getPropertyNames()

            const hasAllProperties = this.static().requiredProperties.every(value => newPropertyNames.includes(value))
            if (!hasAllProperties) {
                log(true, "actual vs required:", newPropertyNames, this.static().requiredProperties)
                throw new Error("setup() does not add all properties listed in requiredProperties")
            }
        }
    }

    setup() {
        throw new Error("Virtual method setup() called")
    }

    static() {
        return this.constructor as typeof InstanceWrapper
    }

    static IsA(className: string) {
        if (this === InstanceWrapper) return className === "Instance"
        if (this.className === className) {
            return true
        } else {
            const prototype = Object.getPrototypeOf(this)
            return prototype.IsA(className)
        }
    }

    IsA(className: string) {
        return this.static().IsA(className)
    }

    static register() {
        ClassNameToWrapper.set(this.className, this)
        log(false, "Registered InstanceWrapper:", ClassNameToWrapper)
    }

    //virtual functions
    /**
     * @virtual
     */
    created() {

    }

    /**
     * @virtual
     */
    destroy() {

    }

    /**
     * @virtual
     */
    preRender() {
        
    }
}