/**
 * WebCodecs Utilities
 *
 * Exports all utility functions and types for WebCodecs-based video control.
 */

export {
  checkWebCodecsSupport,
  assertWebCodecsSupport,
  isCodecSupported,
  COMMON_CODECS,
  type FeatureSupport
} from './featureDetection';

export { MP4Parser, MP4ParseError } from './MP4Parser';
