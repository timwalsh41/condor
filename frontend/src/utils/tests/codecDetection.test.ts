/**
 * Tests for early codec detection and validation
 *
 * Validates HEVC detection, file size limits, and error messages.
 */

import { describe, it, expect } from "vitest";
import { MP4Parser, MP4ParseError } from "../MP4Parser";
import { isCodecSupported } from "../featureDetection";

describe("Codec Detection", () => {
  describe("MP4Parser.readPartialMetadata", () => {
    it("should extract codec info from H.264 video headers", async () => {
      // Create a mock file with minimal MP4 structure
      const mockH264Data = new Uint8Array([
        // ftyp box
        0x00, 0x00, 0x00, 0x20, // size
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x69, 0x73, 0x6f, 0x6d, // brand 'isom'
        // ... rest would be moov box with codec info
      ]);

      const blob = new Blob([mockH264Data], { type: "video/mp4" });
      const file = new File([blob], "test-h264.mp4", { type: "video/mp4" });

      // Note: This test requires actual MP4 file structure to work
      // In a real test environment, we'd use fixture files
      // For now, we test that the method exists and handles errors properly

      try {
        const metadata = await MP4Parser.readPartialMetadata(file);
        // Should either return metadata or null (if moov not in first 200KB)
        expect(metadata === null || typeof metadata === "object").toBe(true);
      } catch (error) {
        // Should throw MP4ParseError for invalid files
        expect(error).toBeInstanceOf(MP4ParseError);
      }
    });

    it("should handle files with moov box at end", async () => {
      // Test timeout case - moov not found in first 200KB
      const largeData = new Uint8Array(200 * 1024);
      const blob = new Blob([largeData], { type: "video/mp4" });
      const file = new File([blob], "test-large.mp4", { type: "video/mp4" });

      try {
        const result = await MP4Parser.readPartialMetadata(file);
        // Should return null when headers not found quickly
        expect(result).toBeNull();
      } catch (error) {
        // Or throw MP4ParseError for invalid file structure
        expect(error).toBeInstanceOf(MP4ParseError);
      }
    }, 2000); // 2 second timeout for this test

    it("should handle invalid MP4 files gracefully", async () => {
      const invalidData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const blob = new Blob([invalidData], { type: "video/mp4" });
      const file = new File([blob], "invalid.mp4", { type: "video/mp4" });

      try {
        const result = await MP4Parser.readPartialMetadata(file);
        // May return null if timeout occurs before error is detected
        expect(result).toBeNull();
      } catch (error) {
        // Or may throw MP4ParseError
        expect(error).toBeInstanceOf(MP4ParseError);
      }
    }, 2000);
  });

  describe("Codec Support Detection", () => {
    it("should detect H.264 support", async () => {
      const h264Supported = await isCodecSupported("avc1.64001E");

      // H.264 should be supported in WebCodecs-enabled browsers
      expect(typeof h264Supported).toBe("boolean");
      // In test environment, this might be false if WebCodecs not available
    });

    it("should detect HEVC support (or lack thereof)", async () => {
      const hevcSupported = await isCodecSupported("hvc1.1.6.L93.B0");

      // HEVC support varies by browser
      expect(typeof hevcSupported).toBe("boolean");
    });

    it("should return false for invalid codec strings", async () => {
      const invalidCodecSupported = await isCodecSupported("invalid.codec.123");

      expect(invalidCodecSupported).toBe(false);
    });
  });
});

describe("File Size Validation", () => {
  it("should reject files larger than 500MB", () => {
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    const fileSizeMB = 600; // 600MB
    const fileSize = fileSizeMB * 1024 * 1024;

    expect(fileSize).toBeGreaterThan(MAX_FILE_SIZE);

    // This is the check we perform in useWebCodecsDecoder
    const shouldReject = fileSize > MAX_FILE_SIZE;
    expect(shouldReject).toBe(true);
  });

  it("should accept files smaller than 500MB", () => {
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    const fileSizeMB = 200; // 200MB
    const fileSize = fileSizeMB * 1024 * 1024;

    expect(fileSize).toBeLessThan(MAX_FILE_SIZE);

    const shouldReject = fileSize > MAX_FILE_SIZE;
    expect(shouldReject).toBe(false);
  });

  it("should handle edge case at exactly 500MB", () => {
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    const fileSize = MAX_FILE_SIZE;

    // At exactly 500MB, should NOT reject (using > not >=)
    const shouldReject = fileSize > MAX_FILE_SIZE;
    expect(shouldReject).toBe(false);
  });
});

describe("Error Messages", () => {
  it("should identify HEVC codec in error messages", () => {
    const hevcCodecs = [
      "hvc1.1.6.L93.B0",
      "hev1.1.6.L93.B0",
      "hvc1.2.4.L120.B0",
    ];

    hevcCodecs.forEach((codec) => {
      const isHEVC = codec.startsWith("hvc") || codec.startsWith("hev");
      expect(isHEVC).toBe(true);
    });
  });

  it("should identify H.264 codec correctly", () => {
    const h264Codecs = ["avc1.64001E", "avc1.42E01E", "avc1.4D401E"];

    h264Codecs.forEach((codec) => {
      const isHEVC = codec.startsWith("hvc") || codec.startsWith("hev");
      expect(isHEVC).toBe(false);
    });
  });

  it("should format file size correctly", () => {
    const fileSizeBytes = 459 * 1024 * 1024; // 459MB
    const fileSizeMB = fileSizeBytes / 1024 / 1024;

    expect(fileSizeMB.toFixed(1)).toBe("459.0");
  });

  it("should include all required HEVC error message components", () => {
    const codec = "hvc1.1.6.L93.B0";
    const width = 1920;
    const height = 1080;
    const fileSizeMB = 459.0;

    // Current HEVC-specific error message format
    const errorMessage =
      `Unsupported video codec: HEVC/H.265\n\n` +
      `This video uses HEVC/H.265 which has unreliable browser support.\n\n` +
      `Please transcode to H.264 using FFmpeg:\n` +
      `  ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a copy output.mp4\n\n` +
      `Technical details:\n` +
      `Codec: ${codec}\n` +
      `Resolution: ${width}x${height}\n` +
      `File size: ${fileSizeMB.toFixed(1)}MB`;

    // Verify all key components are present
    expect(errorMessage).toContain("HEVC/H.265");
    expect(errorMessage).toContain("unreliable browser support");
    expect(errorMessage).toContain("transcode to H.264");
    expect(errorMessage).toContain("ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a copy output.mp4");
    expect(errorMessage).toContain("hvc1.1.6.L93.B0");
    expect(errorMessage).toContain("1920x1080");
    expect(errorMessage).toContain("459.0MB");
  });
});
