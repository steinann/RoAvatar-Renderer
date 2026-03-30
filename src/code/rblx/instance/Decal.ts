import { DataType, NormalId } from "../constant";
import { Content, Property, Vector2 } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

export class DecalWrapper extends InstanceWrapper {
    static className: string = "Decal"
    static requiredProperties: string[] = [
        "Name",
        "ZIndex",
        "Texture",
        "Face",
        "Transparency",
        "UVOffset",
        "UVScale",
    ]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        //specific
        if (!this.instance.HasProperty("ZIndex")) this.instance.addProperty(new Property("ZIndex", DataType.Int32), 1)
        if (!this.instance.HasProperty("Texture")) this.instance.addProperty(new Property("Texture", DataType.Content), new Content())
        if (!this.instance.HasProperty("Face")) this.instance.addProperty(new Property("Face", DataType.Enum), NormalId.Front)
        if (!this.instance.HasProperty("Transparency")) this.instance.addProperty(new Property("Transparency", DataType.Float32), 0)
        if (!this.instance.HasProperty("UVOffset")) this.instance.addProperty(new Property("UVOffset", DataType.Vector2), new Vector2())
        if (!this.instance.HasProperty("UVScale")) this.instance.addProperty(new Property("UVScale", DataType.Vector2), new Vector2())
    }
}