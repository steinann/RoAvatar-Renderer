//Based on https://google.github.io/draco/spec/

import type SimpleView from "../lib/simple-view";

//Metadata constants 
const METADATA_FLAG_MASK = 32768

//Mesh encoding methods 
const MESH_SEQUENTIAL_ENCODING = 0
const MESH_EDGEBREAKER_ENCODING = 1

//Sequential indices encoding methods 
const SEQUENTIAL_COMPRESSED_INDICES = 0
const SEQUENTIAL_UNCOMPRESSED_INDICES = 1

//Symbol encoding methods
const TAGGED_SYMBOLS = 0
const RAW_SYMBOLS = 1

//ANS constant
const IO_BASE = 256
const TAGGED_RANS_BASE = 16384
const TAGGED_RANS_PRECISION = 4096

//Prediction scheme transform methods
const PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON_CANONICALIZED = 3

//Prediction encoding methods
const PREDICTION_NONE = -2
const PREDICTION_DIFFERENCE = 0

//Sequential attribute encoding methos
const SEQUENTIAL_ATTRIBUTE_ENCODER_NORMALS = 3

type ProbabilityTable = {"prob": 0, "cum_prob": 0}[]


export class DracoDecoder {
    view: SimpleView

    //header
    major_version: number = 0
    minor_version: number = 0
    encoder_type: number = 0
    encoder_method: number = 0

    flags: number = 0

    //metadata
    file_metadata: MetadataElement = new MetadataElement()

    //connectivity data
    num_faces: number = 0
    num_points: number = 0
    connectivity_method: number = 0

    //attribute data
    num_attributes_decoders: number = 0

    att_dec_data_id: Uint8Array = new Uint8Array()
    att_dec_decoder_type: Uint8Array = new Uint8Array()
    att_dec_traversal_method: Uint8Array = new Uint8Array()
    att_dec_num_attributes: Uint32Array = new Uint32Array()
    att_dec_att_type: Uint8Array[] = []
    att_dec_data_type: Uint8Array[] = []
    att_dec_num_components: Uint8Array[] = []
    att_dec_normalized: Uint8Array[] = []
    att_dec_unique_id: Uint32Array[] = []
    seq_att_dec_decoder_type: Uint8Array[] = []

    curr_att: number = 0
    curr_att_dec: number = 0

    is_face_visited_: boolean[] = []
    is_vertex_visited_: boolean[] = []
    
    encoded_attribute_value_index_to_corner_map: Uint32Array[] = []

    att_dec_num_values_to_decode: number[][] = []

    seq_att_dec_prediction_scheme: number[][] = []
    seq_att_dec_prediction_transform_type: number[][] = []
    seq_int_att_dec_compressed: number[][] = []
    seq_int_att_dec_decoded_values: number[][][] = []
    seq_int_att_dec_symbols_to_signed_ints: number[][][] = []

    vertex_visited_point_ids: number[] = []

    //mesh data
    faces: Uint16Array = new Uint16Array()

    constructor(view: SimpleView) {
        this.view = view

        this.ParseHeader();
        if (this. flags & METADATA_FLAG_MASK) {
            this.DecodeMetadata();
        }
        console.log(this)
        this.DecodeConnectivityData();
        this.DecodeAttributeData();
    }

    ParseHeader() {
        const draco_string = this.view.readUtf8String(5)
        if (draco_string !== "DRACO") throw new Error("Data being parse is not DRACO")
        
        this.major_version = this.view.readUint8()
        this.minor_version = this.view.readUint8()
        this.encoder_type = this.view.readUint8()
        this.encoder_method = this.view.readUint8()

        this.flags = this.view.readUint16()
    }

    DecodeMetadata() {
        console.log("metadata")
        const num_att_metadata = this.view.LEB128();

        const att_metadata_id: number[] = new Array(num_att_metadata)
        const att_metadata: MetadataElement[] = new Array(num_att_metadata)
        for (let i = 0; i < num_att_metadata; i++) att_metadata[i] = new MetadataElement()

        for (let i = 0; i < num_att_metadata; ++i) {
            att_metadata_id[i] = this.view.LEB128()
            this.DecodeMetadataElement(att_metadata[i]);
        }

        this.DecodeMetadataElement(this.file_metadata);
    }

    DecodeMetadataElement(metadata: MetadataElement) {
        this.ParseMetadataElement(metadata);

        metadata.sub_metadata_key_size = new Array(metadata.num_sub_metadata)
        metadata.sub_metadata_key = new Array(metadata.num_sub_metadata)
        metadata.sub_metadata = new Array(metadata.num_sub_metadata)
        for (let i = 0; i < metadata.num_sub_metadata; i++) metadata.sub_metadata[i] = new MetadataElement()

        for (let i = 0; i < metadata.num_sub_metadata; ++i) {
            this.ParseSubMetadataKey(metadata, i);
            this.DecodeMetadataElement(metadata.sub_metadata[i]);
        }
    }

    ParseMetadataElement(metadata: MetadataElement) {
        metadata.num_entries = this.view.LEB128()

        metadata.key_size = new Array(metadata.num_entries)
        metadata.key = new Array(metadata.num_entries)

        for (let i = 0; i < metadata.num_entries; ++i) {
            let sz = metadata.key_size[i] = this.view.readUint8()
            metadata.key[i] = new Int8Array(this.view.readBuffer(sz))
            sz = metadata.value_size[i] = this.view.readUint8()
            metadata.value[i] = new Int8Array(this.view.readBuffer(sz))
        }

        metadata.num_sub_metadata = this.view.LEB128()
    }

    ParseSubMetadataKey(metadata: MetadataElement, index: number) {
        const sz = metadata.sub_metadata_key_size[index] = this.view.readUint8()
        metadata.sub_metadata_key[index] = new Int8Array(this.view.readBuffer(sz))
    }

    DecodeConnectivityData() {
        if (this.encoder_method == MESH_SEQUENTIAL_ENCODING) {
            console.log("sequential")
            this.DecodeSequentialConnectivityData();
        } else if (this.encoder_method == MESH_EDGEBREAKER_ENCODING) {
            console.log("edgebreaker")
            //this.DecodeEdgebreakerConnectivityData();
        }
    }

    DecodeSequentialConnectivityData() {
        this.num_faces = this.view.LEB128()
        this.num_points = this.view.LEB128()
        this.connectivity_method = this.view.readUint8()

        this.faces = new Uint16Array(this.num_faces * 3)

        if (this.connectivity_method == SEQUENTIAL_COMPRESSED_INDICES) {
            console.log("compressed indices")
            this.DecodeSequentialCompressedIndices();
        } else if (this.connectivity_method == SEQUENTIAL_UNCOMPRESSED_INDICES) {
            console.log("uncompressed indices")
            this.DecodeSequentialIndices();
        }
    }

    DecodeSequentialIndices() {
        if (this.num_points < 256) {
            this.ParseSequentialIndicesUI8();
        } else if (this.num_points < (1 << 16)) {
            this.ParseSequentialIndicesUI16();
        } else if (this.num_points < (1 << 21)) {
            this.ParseSequentialIndicesVarUI32();
        } else {
            this.ParseSequentialIndicesUI32();
        }
    }

    ParseSequentialIndicesUI8() {
        for (let i = 0; i < this.num_faces; ++i) {
            for (let j = 0; j < 3; ++j) {
                this.faces[i*3 + j] = this.view.readUint8()
            }
        }
    }

    ParseSequentialIndicesUI16() {
        for (let i = 0; i < this.num_faces; ++i) {
            for (let j = 0; j < 3; ++j) {
                this.faces[i*3 + j] = this.view.readUint16()
            }
        }
    }

    ParseSequentialIndicesVarUI32() {
        for (let i = 0; i < this.num_faces; ++i) {
            for (let j = 0; j < 3; ++j) {
                this.faces[i*3 + j] = this.view.LEB128()
            }
        }
    }

    ParseSequentialIndicesUI32() {
        for (let i = 0; i < this.num_faces; ++i) {
            for (let j = 0; j < 3; ++j) {
                this.faces[i*3 + j] = this.view.readUint32()
            }
        }
    }

    DecodeSequentialCompressedIndices() {
        const decoded_symbols: number[] = new Array(this.num_faces * 3)

        this.DecodeSymbols(this.num_faces * 3, 1, decoded_symbols);
        let last_index_value = 0;
        for (let i = 0; i < this.num_faces; ++i) {
            for (let j = 0; j < 3; ++j) {
                const encoded_val = decoded_symbols[i * 3 + j];
                let index_diff = (encoded_val >> 1);
                if (encoded_val & 1)
                    index_diff = -index_diff;
                const val = index_diff + last_index_value;
                this.faces[i*3 + j] = val;
                last_index_value = val;
            }
        }
    }

    DecodeSymbols(num_symbols: number, num_components: number, out_values: number[]) {
        const scheme = this.view.readUint8()
        if (scheme == TAGGED_SYMBOLS) {
            console.log("tagged symbols")
            this.DecodeTaggedSymbols(num_symbols, num_components, out_values);
        } else if (scheme == RAW_SYMBOLS) {
            console.log("raw symbols")
            //TODO
            //this.DecodeRawSymbols(num_symbols, out_values);
        }
    }

    DecodeAttributeData() {
        this.ParseAttributeDecodersData();
        this.vertex_visited_point_ids = new Array(this.num_attributes_decoders).fill(0);
        this.curr_att_dec = 0;
        if (this.encoder_method == MESH_EDGEBREAKER_ENCODING) {
            console.log("edgebreaker!")
            /*DecodeAttributeSeams();
            for (i = 0; i < num_encoded_vertices + num_encoded_split_symbols; ++i) {
            if (is_vert_hole_[i]) {
                UpdateVertexToCornerMap(i);
            }
            }
            for (i = 1; i < num_attributes_decoders; ++i) {
            curr_att_dec = i;
            RecomputeVerticesInternal();
            }
            Attribute_AssignPointsToCorners();*/
        }
        for (let i = 0; i < this.num_attributes_decoders; ++i) {
            this.curr_att_dec = i;
            this.is_face_visited_ = new Array(this.num_faces).fill(false);
            this.is_vertex_visited_ = new Array(this.num_faces * 3).fill(false);
            this.GenerateSequence();
            if (this.encoder_method == MESH_EDGEBREAKER_ENCODING) {
                //UpdatePointToAttributeIndexMapping();
            }
        }

        this.att_dec_num_values_to_decode = new Array(this.num_attributes_decoders)
        for (let i = 0; i < this.num_attributes_decoders; i++) this.att_dec_num_values_to_decode[i] = new Array(this.att_dec_num_attributes[i])

        for (let i = 0; i < this.num_attributes_decoders; ++i) {
            for (let j = 0; j < this.att_dec_num_attributes[i]; ++j) {
                this.att_dec_num_values_to_decode[i][j] =
                this.encoded_attribute_value_index_to_corner_map[i].length;
            }
        }
        for (let i = 0; i < this.num_attributes_decoders; ++i) {
            this.curr_att_dec = i;
            this.DecodePortableAttributes();
            //this.DecodeDataNeededByPortableTransforms();
            //this.TransformAttributesToOriginalFormat();
        }
    }

    DecodePortableAttributes() {
        for (let i = 0; i < this.att_dec_num_attributes[this.att_dec_num_attributes.length - 1]; ++i) {
            this.curr_att = i;
            this.ParsePredictionData();
            if (this.seq_att_dec_prediction_scheme[this.curr_att_dec][i] != PREDICTION_NONE) {
                this.SequentialIntegerAttributeDecoder_DecodeIntegerValues();
            }
        }
    }

    SequentialIntegerAttributeDecoder_DecodeIntegerValues() {
        const num_components = this.GetNumComponents();
        const num_entries = this.att_dec_num_values_to_decode[this.curr_att_dec][this.curr_att];
        const num_values = num_entries * num_components;
        let decoded_symbols: number[] = new Array(num_values)
        if (this.seq_int_att_dec_compressed[this.curr_att_dec][this.curr_att] > 0) {
            this.DecodeSymbols(num_values, num_components, decoded_symbols);
        }
        this.seq_int_att_dec_decoded_values[this.curr_att_dec][this.curr_att] = decoded_symbols;
        if (num_values > 0) {
            if (this.seq_att_dec_prediction_transform_type[this.curr_att_dec][this.curr_att] ==
                PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON_CANONICALIZED) {
                decoded_symbols = this.seq_int_att_dec_decoded_values[this.curr_att_dec][this.curr_att];
                const signed_vals: number[] = new Array(decoded_symbols.length)
                for (let i = 0; i < decoded_symbols.length; ++i) {
                    signed_vals[i] = decoded_symbols[i];
                }
                this.seq_int_att_dec_symbols_to_signed_ints[this.curr_att_dec][this.curr_att] = signed_vals;
            } else {
                this.ConvertSymbolsToSignedInts();
            }
        }
        if (this.seq_att_dec_prediction_scheme[this.curr_att_dec][this.curr_att] != PREDICTION_NONE) {
            console.log("dead end")
            //this.DecodePredictionData(seq_att_dec_prediction_scheme[curr_att_dec][curr_att]);
            //this.PredictionScheme_ComputeOriginalValues(
            //    seq_att_dec_prediction_scheme[curr_att_dec][curr_att], num_entries);
        }
    }

    ConvertSymbolToSignedInt(val: number) {
        const is_positive = !(val & 1);
        val >>= 1;
        if (is_positive) {
            return val;
        }
        val = -val - 1;
        return val;
    }

    ConvertSymbolsToSignedInts() {
        const decoded_symbols = this.seq_int_att_dec_decoded_values[this.curr_att_dec][this.curr_att];

        const decodedArr = new Array(decoded_symbols.length)

        for (let i = 0; i < decoded_symbols.length; ++i) {
            const val = this.ConvertSymbolToSignedInt(decoded_symbols[i]);
            decodedArr[i] = val;
        }

        this.seq_int_att_dec_symbols_to_signed_ints[this.curr_att_dec][this.curr_att] = decodedArr
    }


    GetNumComponents() {
        const decoder_type = this.seq_att_dec_decoder_type[this.curr_att_dec][this.curr_att];
        if (decoder_type == SEQUENTIAL_ATTRIBUTE_ENCODER_NORMALS) {
            const prediction_scheme = this.seq_att_dec_prediction_scheme[this.curr_att_dec][this.curr_att];
            if (prediction_scheme == PREDICTION_DIFFERENCE) {
                return 2;
            }
        }
        return this.att_dec_num_components[this.curr_att_dec][this.curr_att];
    }

    ParsePredictionData() {
        this.seq_att_dec_prediction_scheme[this.curr_att_dec][this.curr_att] = this.view.readInt8()
        if (this.seq_att_dec_prediction_scheme[this.curr_att_dec][this.curr_att] != PREDICTION_NONE) {
            this.seq_att_dec_prediction_transform_type[this.curr_att_dec][this.curr_att] = this.view.readInt8()
            this.seq_int_att_dec_compressed[this.curr_att_dec][this.curr_att] = this.view.readUint8()
        }
    }

    GenerateSequence() {
        if (this.encoder_method == MESH_EDGEBREAKER_ENCODING) {
            //EdgebreakerGenerateSequence();
        } else {
            this.SequentialGenerateSequence();
        }
    }

    SequentialGenerateSequence() {
        this.encoded_attribute_value_index_to_corner_map = new Array(this.num_attributes_decoders)
        for (let i = 0; i < this.num_attributes_decoders; i++) this.encoded_attribute_value_index_to_corner_map[i] = new Uint32Array(this.num_points)

        for (let i = 0; i < this.num_points; ++i) {
            this.encoded_attribute_value_index_to_corner_map[this.curr_att_dec][i] = i;
        }
    }

    ParseAttributeDecodersData() {
        this.num_attributes_decoders = this.view.readUint8()
        
        this.att_dec_data_id = new Uint8Array(this.num_attributes_decoders)
        this.att_dec_decoder_type = new Uint8Array(this.num_attributes_decoders)
        this.att_dec_traversal_method = new Uint8Array(this.num_attributes_decoders)
        this.att_dec_num_attributes = new Uint32Array(this.num_attributes_decoders)

        if (this.encoder_method == MESH_EDGEBREAKER_ENCODING) {
            for (let i = 0; i < this.num_attributes_decoders; ++i) {
                this.att_dec_data_id[i] = this.view.readUint8()
                this.att_dec_decoder_type[i] = this.view.readUint8()
                this.att_dec_traversal_method[i] = this.view.readUint8()
            }
        }
        for (let i = 0; i < this.num_attributes_decoders; ++i) {
            this.att_dec_num_attributes[i] = this.view.LEB128()

            this.att_dec_att_type[i] = new Uint8Array(this.att_dec_num_attributes[i])
            this.att_dec_data_type[i] = new Uint8Array(this.att_dec_num_attributes[i])
            this.att_dec_num_components[i] = new Uint8Array(this.att_dec_num_attributes[i])
            this.att_dec_normalized[i] = new Uint8Array(this.att_dec_num_attributes[i])
            this.att_dec_unique_id[i] = new Uint32Array(this.att_dec_num_attributes[i])
            this.seq_att_dec_decoder_type[i] = new Uint8Array(this.att_dec_num_attributes[i])

            for (let j = 0; j < this.att_dec_num_attributes[i]; ++j) {
                this.att_dec_att_type[i][j] = this.view.readUint8()
                this.att_dec_data_type[i][j] = this.view.readUint8()
                this.att_dec_num_components[i][j] = this.view.readUint8()
                this.att_dec_normalized[i][j] = this.view.readUint8()
                this.att_dec_unique_id[i][j] = this.view.LEB128()
            }
            for (let j = 0; j < this.att_dec_num_attributes[i]; ++j) {
                this.seq_att_dec_decoder_type[i][j] = this.view.readUint8()
            }
        }

        this.seq_att_dec_prediction_scheme = new Array(this.num_attributes_decoders);

        for (let dec = 0; dec < this.num_attributes_decoders; dec++) {
            const numAtt = this.att_dec_num_attributes[dec];
            this.seq_att_dec_prediction_scheme[dec] = new Array(numAtt).fill(PREDICTION_NONE);
        }

        this.seq_att_dec_prediction_transform_type = new Array(this.num_attributes_decoders);

        for (let dec = 0; dec < this.num_attributes_decoders; dec++) {
            const numAtt = this.att_dec_num_attributes[dec];
            this.seq_att_dec_prediction_transform_type[dec] = new Array(numAtt).fill(1);
        }

        this.seq_int_att_dec_compressed = new Array(this.num_attributes_decoders);

        for (let dec = 0; dec < this.num_attributes_decoders; dec++) {
            const numAtt = this.att_dec_num_attributes[dec];
            this.seq_int_att_dec_compressed[dec] = new Array(numAtt).fill(0);
        }

        this.seq_int_att_dec_decoded_values = new Array(this.num_attributes_decoders);

        for (let dec = 0; dec < this.num_attributes_decoders; dec++) {
            const numAtt = this.att_dec_num_attributes[dec];
            this.seq_int_att_dec_decoded_values[dec] = new Array(numAtt);
        }

        this.seq_int_att_dec_symbols_to_signed_ints = new Array(this.num_attributes_decoders);

        for (let dec = 0; dec < this.num_attributes_decoders; dec++) {
            const numAtt = this.att_dec_num_attributes[dec];
            this.seq_int_att_dec_symbols_to_signed_ints[dec] = new Array(numAtt);
        }
    }

    DecodeTaggedSymbols(num_values: number, num_components: number, out_values: number[]) {
        const num_symbols_ = this.view.readUint32()

        const probability_table_: ProbabilityTable = new Array(num_symbols_)
        for (let i = 0; i < num_symbols_; i++) probability_table_[i] = {"prob": 0, "cum_prob": 0}

        const lut_table_: number[] = new Array(TAGGED_RANS_PRECISION)

        this.BuildSymbolTables(num_symbols_, lut_table_, probability_table_);
        const size = Number(this.view.readUint64())
        const encoded_data = this.view.readBuffer(size)
        
        const ans_decoder_ = new ANSDecoder(encoded_data, size, TAGGED_RANS_BASE);
        for (let i = 0; i < num_values; i += num_components) {
            const bit_length = ans_decoder_.RansRead(TAGGED_RANS_BASE, TAGGED_RANS_PRECISION, lut_table_, probability_table_);
            for (let j = 0; j < num_components; ++j) {
                const val = this.view.readBits(bit_length)
                out_values.push(val);
            }
            this.view.ResetBitReader();
        }
    }

    BuildSymbolTables(num_symbols_: number, lut_table_: number[], probability_table_: ProbabilityTable) {
        const token_probs: number[] = new Array(num_symbols_)

        for (let i = 0; i < num_symbols_; ++i) {
            // Decode the first byte and extract the number of extra bytes we need to
            // get, or the offset to the next symbol with non-zero probability.
            const prob_data = this.view.readUint8()
            const token = prob_data & 3;
            if (token == 3) {
                const offset = prob_data >> 2;
                for (let j = 0; j < offset + 1; ++j) {
                    token_probs[i + j] = 0;
                }
                i += offset;
            } else {
                let prob = prob_data >> 2;
                for (let j = 0; j < token; ++j) {
                    const eb = this.view.readUint8()
                    prob = prob | (eb << (8 * (j + 1) - 2));
                }
                token_probs[i] = prob;
            }
        }
        this.rans_build_look_up_table(token_probs, num_symbols_, lut_table_, probability_table_);
    }

    rans_build_look_up_table(
        token_probs: number[],
        num_symbols: number,
        lut_table: number[],
        probability_table: { prob: number; cum_prob: number }[]
    ) {
        let cum_prob = 0;
        let act_prob = 0;

        for (let i = 0; i < num_symbols; i++) {
            const p = token_probs[i];

            probability_table[i].prob = p;
            probability_table[i].cum_prob = cum_prob;

            cum_prob += p;

            for (let j = act_prob; j < cum_prob; j++) {
                lut_table[j] = i;
            }

            act_prob = cum_prob;
        }
    }
}

class ANSDecoder {
    buf: Uint8Array
    buf_offset: number = 0
    state: number = 0

    constructor(buf: Uint8Array, offset: number, l_rans_base: number) {
        this.buf = buf;

        const x = buf[offset - 1] >> 6;
        if (x == 0) {
            this.buf_offset = offset - 1;
            this.state = buf[offset - 1] & 0x3F;
        } else if (x == 1) {
            this.buf_offset = offset - 2;
            this.state = mem_get_le16(buf, offset - 2) & 0x3FFF;
        } else if (x == 2) {
            this.buf_offset = offset - 3;
            this.state = mem_get_le24(buf, offset - 3) & 0x3FFFFF;
        } else if (x == 3) {
            this.buf_offset = offset - 4;
            this.state = mem_get_le32(buf, offset - 4) & 0x3FFFFFFF;
        }
        this.state += l_rans_base;
    }

    RansRead(l_rans_base: number, rans_precision: number, lut_table_: number[], probability_table_: ProbabilityTable) {
        while (this.state < l_rans_base && this.buf_offset > 0) {
            this.state = this.state * IO_BASE + this.buf[--this.buf_offset];
        }
        const quo = this.state / rans_precision;
        const rem = this.state % rans_precision;
        
        const sym = fetch_sym(rem, lut_table_, probability_table_);
        this.state = quo * sym.prob + rem - sym.cum_prob;
        return sym.val
    }
}

function fetch_sym(rem: number, lut_table_: number[], probability_table_: ProbabilityTable) {
    const sym = {"val": 0, "prob": 0, "cum_prob": 0}
    const symbol = lut_table_[rem];
    sym.val = symbol;
    sym.prob = probability_table_[symbol].prob;
    sym.cum_prob = probability_table_[symbol].cum_prob;
    return sym
}

class MetadataElement {
    num_entries: number = 0

    key_size: number[] = []
    key: Int8Array[] = []

    value_size: number[] = []
    value: Int8Array[] = []

    num_sub_metadata: number = 0

    sub_metadata_key_size: number[] = []
    sub_metadata_key: Int8Array[] = []
    sub_metadata: MetadataElement[] = []
}

function mem_get_le16(mem: Uint8Array, offset: number = 0) {
    let val = mem[offset + 1] << 8;
    val |= mem[offset + 0];
    return val;
}

function mem_get_le24(mem: Uint8Array, offset: number = 0) {
    let val = mem[offset + 2] << 16;
    val |= mem[offset + 1] << 8;
    val |= mem[offset + 0];
    return val;
}

function mem_get_le32(mem: Uint8Array, offset: number = 0) {
    let val = mem[offset + 3] << 24;
    val |= mem[offset + 2] << 16;
    val |= mem[offset + 1] << 8;
    val |= mem[offset + 0];
    return val;
}