import { API } from "../../api";
import { FLAGS } from "../../misc/flags";
import { DataType } from "../constant";
import { Content, Property } from "../rbx";
import { InstanceWrapper } from "./InstanceWrapper";

class SoundWrapperData {
    audioContext: AudioContext | undefined
    gainNode: GainNode | undefined
    buffer: AudioBuffer | undefined
    playingSource: AudioBufferSourceNode | undefined
}

/**
 * @category InstanceWrapper
 */
export class SoundWrapper extends InstanceWrapper {
    static className: string = "Sound"
    static requiredProperties: string[] = ["Name", "Looped", "Playing", "Volume", "_data"]

    setup() {
        //generic
        if (!this.instance.HasProperty("Name")) this.instance.addProperty(new Property("Name", DataType.String), this.instance.className)

        if (!this.instance.HasProperty("Looped")) this.instance.addProperty(new Property("Looped", DataType.Bool), false)
        if (!this.instance.HasProperty("Playing")) this.instance.addProperty(new Property("Playing", DataType.Bool), false)
        if (!this.instance.HasProperty("Volume")) this.instance.addProperty(new Property("Volume", DataType.Float32), false)

        if (!this.instance.HasProperty("_data")) this.instance.addProperty(new Property("_data", DataType.NonSerializable), new SoundWrapperData())
    }

    get data() {
        return this.instance.Prop("_data") as SoundWrapperData
    }

    created() {
        if (this.instance.Prop("Playing")) {
            this.Play()
        }

        this.instance.Destroying.Connect(() => {
            //cleanup audio
            if (this.data.playingSource) {
                this.Stop()
            }

            this.data.audioContext = undefined
            this.data.gainNode = undefined
            this.data.buffer = undefined
        })
    }

    _updateVolume() {
        if (this.data.gainNode) {
            if (this.instance.HasProperty("Volume")) {
                const volume = this.instance.Prop("Volume") as number
                
                this.data.gainNode.gain.value = volume
            }
        }
    }

    setPlaying(value: boolean) {
        this.instance.setProperty("Playing", value)
    }

    playSource() {
        if (!this.data.audioContext || !this.data.gainNode || !this.data.buffer) return

        this.data.playingSource = this.data.audioContext.createBufferSource()
        this.data.playingSource.buffer = this.data.buffer

        //connect audio
        this.data.playingSource.connect(this.data.gainNode)
        this.data.gainNode.connect(this.data.audioContext.destination)

        //update volume and play
        this._updateVolume()
        this.data.playingSource.start(0)
        this.data.playingSource.onended = (() => {
            if (this.instance.Prop("Looped")) {
                this.Play()
            } else {
                this.Stop()
            }
        })
    }

    Play() {
        if (!FLAGS.AUDIO_ENABLED) return

        this.Stop()
        this.setPlaying(true)
        
        //create audioContext and gainNode
        if (!this.data.audioContext) {
            this.data.audioContext = new AudioContext()
        }

        if (!this.data.gainNode) {
            this.data.gainNode = this.data.audioContext.createGain()
        }

        if (!this.data.buffer) {
            //find audio url
            let audioUrl = undefined
            if (this.instance.HasProperty("SoundId")) {
                audioUrl = this.instance.Prop("SoundId") as string
            } else if (this.instance.HasProperty("AudioContent")) {
                audioUrl = (this.instance.Prop("AudioContent") as Content).uri
            }

            if (audioUrl && audioUrl.length > 0) {
                //load audio buffer
                API.Asset.GetAssetBuffer(audioUrl).then((responseBuffer) => {
                    if (responseBuffer instanceof Response || !this.data.audioContext) return

                    const buffer = responseBuffer.slice(0)

                    //decode audio buffer
                    this.data.audioContext.decodeAudioData(buffer).then(decodedData => {
                        if (!this.data.audioContext || !this.data.gainNode) return
                        this.data.buffer = decodedData

                        this.playSource()
                    })
                })
            }
        } else if (this.data.buffer) {
            //play audio
            this.playSource()
        }
    }

    Stop() {
        this.setPlaying(false)
        
        //stop audio
        if (this.data.playingSource) {
            this.data.playingSource.stop()
            this.data.playingSource = undefined
        }
    }
}