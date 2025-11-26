/**
 * MP4 Container Parser
 *
 * Parses MP4 video files using mp4box.js to extract codec configuration
 * and frame samples for WebCodecs VideoDecoder.
 *
 * Supports H.264 (AVC) and H.265 (HEVC) codecs.
 */

import { createFile } from "mp4box";
import type { MP4File, MP4Info, MP4VideoTrack, Sample } from "mp4box";

/**
 * Error thrown when MP4 parsing fails
 */
export class MP4ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MP4ParseError";
  }
}

/**
 * MP4 Container Parser
 *
 * Parses MP4 files and extracts codec configuration and samples
 * for use with WebCodecs VideoDecoder.
 *
 * @example
 * ```typescript
 * const parser = new MP4Parser();
 * await parser.initialize(videoFile);
 * const config = parser.getCodecConfig();
 * const samples = parser.getSamples();
 * console.log(`Loaded ${parser.getFrameCount()} frames`);
 * ```
 */
export class MP4Parser {
  private mp4File: MP4File | null = null;
  private videoTrack: MP4VideoTrack | null = null;
  private samples: Sample[] = [];
  private info: MP4Info | null = null;

  /**
   * Initialize parser with MP4 file
   *
   * @param videoFile - MP4 video file to parse
   * @throws {MP4ParseError} If file is invalid, corrupt, or has no video track
   */
  async initialize(videoFile: File): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create MP4Box file instance
      const mp4boxFile = createFile();
      this.mp4File = mp4boxFile;

      // Set timeout to detect invalid files that mp4box doesn't explicitly reject
      const timeout = setTimeout(() => {
        reject(
          new MP4ParseError(
            "Failed to parse MP4 file: timeout waiting for file to be parsed. File may be invalid or corrupt."
          )
        );
      }, 5000);

      // Set up ready callback - fires when MP4 headers are parsed
      mp4boxFile.onReady = (info: MP4Info) => {
        clearTimeout(timeout);
        this.info = info;

        // Find video track
        if (!info.videoTracks || info.videoTracks.length === 0) {
          reject(new MP4ParseError("No video track found in MP4 file"));
          return;
        }

        // Use first video track
        this.videoTrack = info.videoTracks[0];

        // Request extraction of all samples for this track
        mp4boxFile.setExtractionOptions(this.videoTrack.id, undefined, {
          nbSamples: Infinity,
        });

        // Start sample extraction
        mp4boxFile.start();
      };

      // Set up error callback
      mp4boxFile.onError = (error: string) => {
        clearTimeout(timeout);
        reject(new MP4ParseError(`Failed to parse MP4 file: ${error}`));
      };

      // Set up samples callback - fires when samples are extracted
      mp4boxFile.onSamples = (
        trackId: number,
        _user: unknown,
        samples: Sample[]
      ) => {
        if (this.videoTrack && trackId === this.videoTrack.id) {
          this.samples.push(...samples);

          // If we've received all samples, resolve
          if (this.samples.length >= (this.videoTrack.nb_samples || 0)) {
            clearTimeout(timeout);
            resolve();
          }
        }
      };

      // Read file as ArrayBuffer
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new MP4ParseError("Failed to read file"));
          return;
        }

        const arrayBuffer = e.target.result as ArrayBuffer;

        // MP4Box requires ArrayBuffer with fileStart property
        const buffer = arrayBuffer as ArrayBuffer & { fileStart: number };
        buffer.fileStart = 0;

        // Append buffer to mp4box
        mp4boxFile.appendBuffer(buffer);

        // Signal end of file
        mp4boxFile.flush();
      };

      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new MP4ParseError("Failed to read file"));
      };

      // Start reading file
      reader.readAsArrayBuffer(videoFile);
    });
  }

  /**
   * Get VideoDecoderConfig for WebCodecs VideoDecoder
   *
   * @returns VideoDecoderConfig with codec, dimensions, and description
   * @throws {MP4ParseError} If parser not initialized or codec unsupported
   */
  getCodecConfig(): VideoDecoderConfig {
    if (!this.videoTrack || !this.info) {
      throw new MP4ParseError(
        "Parser not initialized. Call initialize() first."
      );
    }

    const track = this.videoTrack;

    // Extract codec string
    const codec = this.extractCodecString();

    // Extract description (avcC or hvcC box data)
    const description = this.extractDescription();

    // Option: detect Firefox for hardware acceleration workaround
    // Firefox's hardware decoder has stricter H.264 format validation than Chrome
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1918769
    // const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
    // In practice we will use software decoding for all browsers as that seems to
    // be the most stable

    // Build VideoDecoderConfig
    // (Note we are leaving the code commented in place to select prefer hardware
    // or not to register a preference)
    const config: VideoDecoderConfig = {
      codec,
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      description,
      // Use software decoder for Firefox to avoid "encoding not supported" errors
      hardwareAcceleration: "prefer-software", // isFirefox ? "prefer-software" : undefined, // "prefer-hardware",
    };

    return config;
  }

  /**
   * Extract codec string from track info
   *
   * @returns Codec string in format suitable for VideoDecoderConfig
   * @throws {MP4ParseError} If codec is unsupported
   */
  private extractCodecString(): string {
    if (!this.videoTrack) {
      throw new MP4ParseError("No video track available");
    }

    const track = this.videoTrack;

    // mp4box.js provides codec string in track.codec
    // Format examples:
    // - H.264: "avc1.64001f" (avc1.PPCCLL - profile, constraints, level)
    // - H.265: "hvc1.1.6.L93.B0" or "hev1.1.6.L93.B0"
    if (track.codec) {
      return track.codec;
    }

    // Fallback: construct from track type
    // This handles cases where mp4box.js doesn't provide codec string
    const codecType = track.type;

    if (codecType === "avc1" || codecType === "avc3") {
      // H.264 - use generic codec string
      // In practice, mp4box.js should provide the full string
      return "avc1.64001f"; // H.264 High Profile Level 3.1
    }

    if (codecType === "hvc1" || codecType === "hev1") {
      // H.265 - use generic codec string
      return "hvc1.1.6.L93.B0"; // H.265 Main Profile Level 3.1
    }

    throw new MP4ParseError(
      `Unsupported video codec: ${codecType}. Only H.264 (avc1) and H.265 (hvc1/hev1) are supported.`
    );
  }

  /**
   * Extract description box (avcC or hvcC) for VideoDecoderConfig
   *
   * The description contains codec-specific configuration data needed
   * for decoder initialization.
   *
   * @returns Uint8Array containing avcC or hvcC box data
   * @throws {MP4ParseError} If description data not available
   */
  private extractDescription(): Uint8Array {
    if (!this.videoTrack || !this.mp4File) {
      throw new MP4ParseError("No video track available");
    }

    // Get the full track structure from mp4file to access the sample description
    const fullTrack = this.mp4File.getTrackById(this.videoTrack.id) as any;

    if (!fullTrack?.mdia?.minf?.stbl?.stsd?.entries?.[0]) {
      throw new MP4ParseError(
        "Cannot access sample description in MP4 file. File may be corrupt."
      );
    }

    const sampleEntry = fullTrack.mdia.minf.stbl.stsd.entries[0];

    // Extract avcC or hvcC box data
    const configBox = sampleEntry.avcC || sampleEntry.hvcC;

    if (!configBox) {
      throw new MP4ParseError(
        `No codec configuration box found. Codec type: ${
          sampleEntry.box_name || "unknown"
        }`
      );
    }

    // Serialize the configuration box to binary data
    // WebCodecs expects the raw box data (without the box header)
    return this.serializeConfigBox(configBox);
  }

  /**
   * Serialize codec configuration box (avcC or hvcC) to Uint8Array
   *
   * Converts the mp4box.js config box object to the binary format
   * expected by WebCodecs VideoDecoderConfig.
   *
   * @param configBox - avcC or hvcC box from mp4box.js
   * @returns Serialized configuration data
   */
  private serializeConfigBox(configBox: any): Uint8Array {
    // For avcC boxes, we need to serialize: version, profile, compatibility, level, and SPS/PPS NALUs
    // For hvcC boxes, similar but with HEVC-specific structure

    if (configBox.box_name === "AVCConfigurationBox") {
      return this.serializeAVCC(configBox);
    } else if (configBox.box_name === "HEVCConfigurationBox") {
      return this.serializeHVCC(configBox);
    }

    throw new MP4ParseError(
      `Unsupported configuration box type: ${configBox.box_name || "unknown"}`
    );
  }

  /**
   * Serialize avcC box to binary format for VideoDecoderConfig
   */
  private serializeAVCC(avcC: any): Uint8Array {
    // Calculate total size
    let size = 7; // Fixed header: version(1) + profile(1) + compat(1) + level(1) + lengthSize(1) + numSPS(1) + reserve(1)

    // Add SPS data
    for (const sps of avcC.SPS) {
      size += 2 + sps.length; // length field (2 bytes) + data
    }

    size += 1; // numPPS field

    // Add PPS data
    for (const pps of avcC.PPS) {
      size += 2 + pps.length; // length field (2 bytes) + data
    }

    const data = new Uint8Array(size);
    let offset = 0;

    // Write avcC header
    data[offset++] = avcC.configurationVersion || 1;
    data[offset++] = avcC.AVCProfileIndication;
    data[offset++] = avcC.profile_compatibility;
    data[offset++] = avcC.AVCLevelIndication;
    data[offset++] = 0xff | (avcC.lengthSizeMinusOne & 0x03); // 6 bits reserved (111111) + 2 bits length
    data[offset++] = 0xe0 | (avcC.nb_SPS_nalus & 0x1f); // 3 bits reserved (111) + 5 bits numSPS

    // Write SPS NAL units
    for (const sps of avcC.SPS) {
      data[offset++] = (sps.length >> 8) & 0xff;
      data[offset++] = sps.length & 0xff;
      data.set(sps.data, offset);
      offset += sps.length;
    }

    // Write PPS count and NAL units
    data[offset++] = avcC.nb_PPS_nalus;

    for (const pps of avcC.PPS) {
      data[offset++] = (pps.length >> 8) & 0xff;
      data[offset++] = pps.length & 0xff;
      data.set(pps.data, offset);
      offset += pps.length;
    }

    return data;
  }

  /**
   * Serialize hvcC box to binary format for VideoDecoderConfig
   *
   * HEVC configuration structure is defined in ISO/IEC 14496-15
   */
  private serializeHVCC(hvcC: any): Uint8Array {
    // Calculate total size
    let size = 23; // Fixed header size for hvcC

    // Add size for all NAL unit arrays
    for (const naluArray of hvcC.nalu_arrays) {
      size += 3; // array_completeness + NAL_unit_type (1 byte) + numNalus (2 bytes)
      for (const nalu of naluArray) {
        if (nalu.data) {
          size += 2 + nalu.data.length; // nalUnitLength (2 bytes) + data
        }
      }
    }

    const data = new Uint8Array(size);
    let offset = 0;

    // Write hvcC header
    data[offset++] = hvcC.configurationVersion || 1;

    // Profile, tier, level (byte 1-12)
    data[offset++] =
      ((hvcC.general_profile_space & 0x03) << 6) |
      ((hvcC.general_tier_flag & 0x01) << 5) |
      (hvcC.general_profile_idc & 0x1f);

    // general_profile_compatibility_flags (4 bytes)
    const profileCompat = hvcC.general_profile_compatibility || 0;
    data[offset++] = (profileCompat >> 24) & 0xff;
    data[offset++] = (profileCompat >> 16) & 0xff;
    data[offset++] = (profileCompat >> 8) & 0xff;
    data[offset++] = profileCompat & 0xff;

    // general_constraint_indicator_flags (6 bytes)
    const constraints = hvcC.general_constraint_indicator || new Uint8Array(6);
    data.set(constraints.slice(0, 6), offset);
    offset += 6;

    // general_level_idc (1 byte)
    data[offset++] = hvcC.general_level_idc;

    // min_spatial_segmentation_idc (2 bytes, 4 bits reserved)
    data[offset++] = 0xf0 | ((hvcC.min_spatial_segmentation_idc >> 8) & 0x0f);
    data[offset++] = hvcC.min_spatial_segmentation_idc & 0xff;

    // parallelismType (1 byte, 6 bits reserved)
    data[offset++] = 0xfc | (hvcC.parallelismType & 0x03);

    // chroma_format_idc (1 byte, 6 bits reserved)
    data[offset++] = 0xfc | (hvcC.chroma_format_idc & 0x03);

    // bit_depth_luma_minus8 (1 byte, 5 bits reserved)
    data[offset++] = 0xf8 | (hvcC.bit_depth_luma_minus8 & 0x07);

    // bit_depth_chroma_minus8 (1 byte, 5 bits reserved)
    data[offset++] = 0xf8 | (hvcC.bit_depth_chroma_minus8 & 0x07);

    // avgFrameRate (2 bytes)
    data[offset++] = (hvcC.avgFrameRate >> 8) & 0xff;
    data[offset++] = hvcC.avgFrameRate & 0xff;

    // constantFrameRate, numTemporalLayers, temporalIdNested, lengthSizeMinusOne (1 byte)
    data[offset++] =
      ((hvcC.constantFrameRate & 0x03) << 6) |
      ((hvcC.numTemporalLayers & 0x07) << 3) |
      ((hvcC.temporalIdNested & 0x01) << 2) |
      (hvcC.lengthSizeMinusOne & 0x03);

    // numOfArrays (1 byte)
    data[offset++] = hvcC.nalu_arrays.length;

    // Write NAL unit arrays (VPS, SPS, PPS, etc.)
    for (const naluArray of hvcC.nalu_arrays) {
      // array_completeness (1 bit) + reserved (1 bit) + NAL_unit_type (6 bits)
      data[offset++] =
        ((naluArray.completeness & 0x01) << 7) | (naluArray.nalu_type & 0x3f);

      // numNalus (2 bytes)
      const numNalus = naluArray.length;
      data[offset++] = (numNalus >> 8) & 0xff;
      data[offset++] = numNalus & 0xff;

      // Write each NAL unit
      for (const nalu of naluArray) {
        if (nalu.data) {
          const naluLength = nalu.data.length;
          data[offset++] = (naluLength >> 8) & 0xff;
          data[offset++] = naluLength & 0xff;
          data.set(nalu.data, offset);
          offset += naluLength;
        }
      }
    }

    return data;
  }

  /**
   * Get all video samples
   *
   * @returns Array of MP4 samples with timestamps, data, and metadata
   * @throws {MP4ParseError} If parser not initialized
   */
  getSamples(): Sample[] {
    if (!this.samples || this.samples.length === 0) {
      throw new MP4ParseError(
        "No samples available. Parser may not be initialized or file has no video data."
      );
    }

    return this.samples;
  }

  /**
   * Get total frame count
   *
   * @returns Number of frames in video
   * @throws {MP4ParseError} If parser not initialized
   */
  getFrameCount(): number {
    if (!this.videoTrack) {
      throw new MP4ParseError(
        "Parser not initialized. Call initialize() first."
      );
    }

    return this.videoTrack.nb_samples || 0;
  }

  /**
   * Get video track information
   *
   * @returns Video track metadata (dimensions, framerate, duration, etc.)
   * @throws {MP4ParseError} If parser not initialized
   */
  getVideoTrackInfo(): MP4VideoTrack {
    if (!this.videoTrack) {
      throw new MP4ParseError(
        "Parser not initialized. Call initialize() first."
      );
    }

    return this.videoTrack;
  }

  /**
   * Get MP4 file information
   *
   * @returns Complete MP4 file metadata
   * @throws {MP4ParseError} If parser not initialized
   */
  getFileInfo(): MP4Info {
    if (!this.info) {
      throw new MP4ParseError(
        "Parser not initialized. Call initialize() first."
      );
    }

    return this.info;
  }

  /**
   * Get video framerate (frames per second)
   *
   * @returns Framerate in fps (e.g., 30, 60)
   * @throws {MP4ParseError} If parser not initialized
   */
  getFramerate(): number {
    if (!this.videoTrack) {
      throw new MP4ParseError(
        "Parser not initialized. Call initialize() first."
      );
    }

    const track = this.videoTrack;

    // Framerate = samples / duration_in_seconds
    // duration is in timescale units, so: duration_in_seconds = duration / timescale
    // Therefore: framerate = nb_samples / (duration / timescale) = (nb_samples * timescale) / duration
    if (track.nb_samples && track.duration && track.timescale) {
      return (track.nb_samples * track.timescale) / track.duration;
    }

    // Fallback: use 30fps if calculation fails
    console.warn(
      "[MP4Parser] Could not calculate framerate, using default 30fps"
    );
    return 30;
  }

  /**
   * Calculate average GOP (Group of Pictures) size
   *
   * GOP size is the distance between keyframes (I-frames).
   * For GOP=30 optimized videos, this should return 30.
   *
   * @returns Average GOP size in frames
   * @throws {MP4ParseError} If parser not initialized
   */
  getGopSize(): number {
    if (this.samples.length === 0) {
      throw new MP4ParseError(
        "No samples available. Parser may not be initialized."
      );
    }

    // Find all keyframe indices
    const keyframeIndices: number[] = [];
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].is_sync) {
        keyframeIndices.push(i);
      }
    }

    // Need at least 2 keyframes to calculate distance
    if (keyframeIndices.length < 2) {
      return this.samples.length; // All frames (or close to it)
    }

    // Calculate distances between consecutive keyframes
    const distances: number[] = [];
    for (let i = 0; i < keyframeIndices.length - 1; i++) {
      distances.push(keyframeIndices[i + 1] - keyframeIndices[i]);
    }

    // Return average distance
    const sum = distances.reduce((a, b) => a + b, 0);
    return Math.round(sum / distances.length);
  }
}
