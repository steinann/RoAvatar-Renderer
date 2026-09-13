import { BasePartWrapper } from "./BasePart"

/**
 * @category InstanceWrapper
 */
export class UnionOperationWrapper extends BasePartWrapper {
    static className: string = "UnionOperation"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
    ]

    setup() {
        super.setup()
    }
}