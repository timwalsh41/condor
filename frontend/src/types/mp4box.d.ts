/**
 * TypeScript type definitions for mp4box.js
 *
 * Minimal type definitions covering the functionality needed for WebCodecs integration.
 * Based on mp4box.js API: https://github.com/gpac/mp4box.js/
 */

declare module 'mp4box' {
  /**
   * Create a new MP4File instance for parsing MP4 containers
   */
  export function createFile(): MP4File;

  /**
   * MP4Box file instance for parsing MP4 containers
   */
  export interface MP4File {
    /**
     * Callback fired when MP4 file is parsed and ready
     */
    onReady?: (info: MP4Info) => void;

    /**
     * Callback fired on parsing errors
     */
    onError?: (error: string) => void;

    /**
     * Callback for receiving extracted samples (frames)
     */
    onSamples?: (id: number, user: unknown, samples: Sample[]) => void;

    /**
     * Append data to the MP4 parser
     * @param data - ArrayBuffer with MP4 data
     */
    appendBuffer(data: ArrayBuffer & { fileStart: number }): number;

    /**
     * Signal end of data stream
     */
    flush(): void;

    /**
     * Configure sample extraction for a track
     * @param trackId - Track ID to extract samples from
     * @param user - User data passed to onSamples callback
     * @param options - Extraction options
     */
    setExtractionOptions(
      trackId: number,
      user?: unknown,
      options?: { nbSamples?: number }
    ): void;

    /**
     * Start sample extraction for configured tracks
     */
    start(): void;

    /**
     * Stop sample extraction
     */
    stop(): void;

    /**
     * Seek to a specific time
     * @param time - Time in seconds
     * @param useRap - Use Random Access Point (keyframe)
     */
    seek(time: number, useRap?: boolean): { offset: number; time: number };

    /**
     * Get track information by ID
     * @param trackId - Track ID
     */
    getTrackById(trackId: number): MP4Track | undefined;
  }

  /**
   * MP4 file information returned by onReady callback
   */
  export interface MP4Info {
    /** Duration in seconds */
    duration: number;

    /** Timescale (ticks per second) */
    timescale: number;

    /** Fragmented MP4 flag */
    isFragmented: boolean;

    /** Progressive download flag */
    isProgressive: boolean;

    /** Has IOD (Initial Object Descriptor) */
    hasIOD: boolean;

    /** Brands (e.g., ["isom", "avc1"]) */
    brands: string[];

    /** Video tracks */
    videoTracks: MP4VideoTrack[];

    /** Audio tracks */
    audioTracks: MP4AudioTrack[];

    /** All tracks */
    tracks: MP4Track[];

    /** MIME type */
    mime: string;
  }

  /**
   * Base track information
   */
  export interface MP4Track {
    /** Track ID */
    id: number;

    /** Track creation time */
    created: Date;

    /** Track modification time */
    modified: Date;

    /** Track duration in timescale units */
    duration: number;

    /** Track timescale */
    timescale: number;

    /** Track language */
    language: string;

    /** Number of samples (frames) */
    nb_samples: number;

    /** Track type */
    type: string;

    /** Codec string */
    codec: string;

    /** Transformation matrix (9 elements representing 3x3 matrix) */
    matrix?: number[];
  }

  /**
   * Video track specific information
   */
  export interface MP4VideoTrack extends MP4Track {
    /** Video track metadata */
    video: {
      /** Video width in pixels */
      width: number;

      /** Video height in pixels */
      height: number;
    };

    /** Codec-specific description bytes (e.g., avcC box for H.264) */
    description?: Uint8Array;

    /** Codec-specific description as ArrayBuffer */
    description_boxes?: ArrayBuffer[];
  }

  /**
   * Audio track specific information
   */
  export interface MP4AudioTrack extends MP4Track {
    /** Audio track metadata */
    audio: {
      /** Sample rate in Hz */
      sample_rate: number;

      /** Number of channels */
      channel_count: number;

      /** Sample size in bits */
      sample_size: number;
    };
  }

  /**
   * Video/audio sample (frame) data
   */
  export interface Sample {
    /** Track ID this sample belongs to */
    track_id: number;

    /** Sample number (0-based frame index) */
    number: number;

    /** Composition Time Stamp (presentation time in timescale units) */
    cts: number;

    /** Decode Time Stamp (decode time in timescale units) */
    dts: number;

    /** Sample duration in timescale units */
    duration: number;

    /** Sample size in bytes */
    size: number;

    /** Sample data */
    data: Uint8Array;

    /** Is sync sample (keyframe/I-frame) */
    is_sync: boolean;

    /** Is leading sample */
    is_leading: number;

    /** Depends on other samples */
    depends_on: number;

    /** Is depended on by other samples */
    is_depended_on: number;

    /** Has redundancy */
    has_redundancy: number;

    /** Degradation priority */
    degradation_priority: number;

    /** Sample description index */
    description_index: number;
  }

  /**
   * DataStream for binary data handling
   */
  export interface DataStream {
    buffer: ArrayBuffer;
    position: number;
    endianness: number;
  }

}

/**
 * Namespace export to support file-based imports.
 * Allows: import type { MP4BoxSDK } from '../types/mp4box';
 */
export namespace MP4BoxSDK {
  export type {
    MP4File,
    MP4Info,
    MP4Track,
    MP4VideoTrack,
    MP4AudioTrack,
    Sample,
    DataStream,
  };
}
