import { AccessoryWrapper } from "./instance/Accessory";
import { AccessoryDescriptionWrapper } from "./instance/AccessoryDescription";
import { AnimationConstraintWrapper } from "./instance/AnimationConstraint";
import { AnimatorWrapper } from "./instance/Animator";
import { BodyColorsWrapper } from "./instance/BodyColors";
import { BodyPartDescriptionWrapper } from "./instance/BodyPartDescription";
import { FaceControlsWrapper } from "./instance/FaceControls";
import { HumanoidDescriptionWrapper } from "./instance/HumanoidDescription";
import { MakeupDescriptionWrapper } from "./instance/MakeupDescription";
import { ManualWeldWrapper } from "./instance/ManualWeld";
import { ModelWrapper } from "./instance/Model";
import { Motor6DWrapper } from "./instance/Motor6D";
import { ScriptWrapper } from "./instance/Script";
import { SoundWrapper } from "./instance/Sound";
import { ToolWrapper } from "./instance/Tool";
import { WeldWrapper } from "./instance/Weld";

//register wrappers
export function RegisterWrappers() {
    ModelWrapper.register()
    ScriptWrapper.register()
    SoundWrapper.register()
    ToolWrapper.register()

    WeldWrapper.register()
    Motor6DWrapper.register()
    ManualWeldWrapper.register()
    AnimationConstraintWrapper.register()

    AnimatorWrapper.register()
    FaceControlsWrapper.register()
    
    HumanoidDescriptionWrapper.register()
    BodyPartDescriptionWrapper.register()
    AccessoryDescriptionWrapper.register()
    MakeupDescriptionWrapper.register()
    BodyColorsWrapper.register()
    AccessoryWrapper.register()
}