/**
 * WebCodecs API Feature Detection
 *
 * Validates browser support for WebCodecs API required for frame-accurate video control.
 *
 * Browser Requirements:
 * - Chrome 94+ (October 2021)
 * - Firefox 130+ (September 2024)
 * - Safari 17.4+ (March 2024)
 * - Edge 94+ (Chromium-based)
 *
 * Market Coverage: ~95% of active browsers
 */

export interface FeatureSupport {
  isSupported: boolean;
  missingFeatures: string[];
  browserInfo: string;
  errorMessage?: string;
}

/**
 * Check if WebCodecs API is supported in the current browser
 *
 * @returns {FeatureSupport} Object containing support status and details
 */
export function checkWebCodecsSupport(): FeatureSupport {
  const missingFeatures: string[] = [];

  // Check for VideoDecoder
  if (typeof VideoDecoder === 'undefined') {
    missingFeatures.push('VideoDecoder');
  }

  // Check for VideoFrame
  if (typeof VideoFrame === 'undefined') {
    missingFeatures.push('VideoFrame');
  }

  // Check for EncodedVideoChunk
  if (typeof EncodedVideoChunk === 'undefined') {
    missingFeatures.push('EncodedVideoChunk');
  }

  // Detect browser info
  const browserInfo = getBrowserInfo();

  const isSupported = missingFeatures.length === 0;

  return {
    isSupported,
    missingFeatures,
    browserInfo,
    errorMessage: isSupported ? undefined : generateErrorMessage(browserInfo, missingFeatures)
  };
}

/**
 * Get browser name and version information
 *
 * @returns {string} Browser identification string
 */
function getBrowserInfo(): string {
  const userAgent = navigator.userAgent;

  // Chrome
  if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) {
      return `Chrome ${match[1]}`;
    }
  }

  // Firefox
  if (userAgent.includes('Firefox/')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) {
      return `Firefox ${match[1]}`;
    }
  }

  // Safari
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+(?:\.\d+)?)/);
    if (match) {
      return `Safari ${match[1]}`;
    }
  }

  // Edge (Chromium-based)
  if (userAgent.includes('Edg/')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    if (match) {
      return `Edge ${match[1]}`;
    }
  }

  return 'Unknown Browser';
}

/**
 * Generate user-friendly error message for unsupported browsers
 *
 * @param {string} browserInfo - Current browser information
 * @param {string[]} missingFeatures - List of missing WebCodecs features
 * @returns {string} Error message with upgrade guidance
 */
function generateErrorMessage(browserInfo: string, missingFeatures: string[]): string {
  const featuresStr = missingFeatures.join(', ');

  return `Your browser (${browserInfo}) doesn't support required video features (${featuresStr}).

Frame-accurate video control requires WebCodecs API support.

Please update to one of these browsers:
• Chrome 94 or newer (recommended)
• Firefox 130 or newer
• Safari 17.4 or newer
• Edge 94 or newer

To check your browser version:
• Chrome/Edge: chrome://version or edge://version
• Firefox: about:support
• Safari: Safari → About Safari`;
}

/**
 * Assert WebCodecs support, throwing an error if not supported
 *
 * @throws {Error} If WebCodecs is not supported
 */
export function assertWebCodecsSupport(): void {
  const support = checkWebCodecsSupport();

  if (!support.isSupported) {
    throw new Error(support.errorMessage);
  }
}

/**
 * Check if specific codec is supported by VideoDecoder
 *
 * @param {string} codec - Codec string (e.g., "avc1.42E01E" for H.264, "hvc1.1.6.L93.B0" for H.265)
 * @returns {Promise<boolean>} True if codec is supported
 */
export async function isCodecSupported(codec: string): Promise<boolean> {
  if (typeof VideoDecoder === 'undefined') {
    return false;
  }

  try {
    const config: VideoDecoderConfig = {
      codec,
      codedWidth: 640,
      codedHeight: 480
    };

    const result = await VideoDecoder.isConfigSupported(config);
    return result.supported ?? false;
  } catch (error) {
    console.error(`Error checking codec support for ${codec}:`, error);
    return false;
  }
}

/**
 * Common codec strings for testing
 */
export const COMMON_CODECS = {
  H264_BASELINE: 'avc1.42E01E',
  H264_MAIN: 'avc1.4D401E',
  H264_HIGH: 'avc1.64001E',
  H265_MAIN: 'hvc1.1.6.L93.B0',
  H265_MAIN10: 'hvc1.2.4.L93.B0'
} as const;
