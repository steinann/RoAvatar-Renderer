import { JointInstanceWrapper } from "./JointInstance";

/**
 * @category InstanceWrapper
 */
export class MotorWrapper extends JointInstanceWrapper {
    static className: string = "Motor"
    static requiredProperties: string[] = [
        ...super.requiredProperties,
    ]

    setup() {
        super.setup()
    }
}