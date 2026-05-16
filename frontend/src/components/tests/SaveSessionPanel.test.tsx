/**
 * Unit tests for SaveSessionPanel component.
 *
 * Tests session save validation logic, including library save prerequisite enforcement.
 *
 * Phase 2, Task 4.1 (Workflow Constraint Implementation)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SaveSessionPanel } from "../SaveSessionPanel";
import * as videoStore from "../../store/videoStore";
import * as libraryStore from "../../store/libraryStore";
import * as sessionStore from "../../store/sessionStore";

describe("SaveSessionPanel", () => {
  const mockSaveSession = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    
    // Mock videoStore
    vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
      videoA: null,
      videoB: null,
    } as any);
    
    // Mock libraryStore
    vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
      videos: [],
      isVideoInLibrary: vi.fn(() => false),
    } as any);
    
    // Mock sessionStore
    vi.spyOn(sessionStore, "useSessionStore").mockReturnValue({
      saveSession: mockSaveSession,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("4.1.1 - Video Library Status Check", () => {
    it("should not render when no videos are loaded", () => {
      render(<SaveSessionPanel />);
      expect(screen.queryByText("💾 Save Session")).toBeNull();
    });

    it("should render when video A is loaded", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      render(<SaveSessionPanel />);
      expect(screen.getByText("💾 Save Session")).toBeTruthy();
    });

    it("should render when video B is loaded", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: null,
        videoB: { metadata: { video_id: "temp-456", filename: "test2.mp4" } },
      } as any);
      
      render(<SaveSessionPanel />);
      expect(screen.getByText("💾 Save Session")).toBeTruthy();
    });

    it("should check video library status using isVideoInLibrary", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  describe("4.1.2 - isVideoInLibrary Helper Function", () => {
    it("should return true when video is in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("should return false when video is not in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should handle missing video_id", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("4.1.3 - Disabled Save Button with Tooltip", () => {
    it("should disable save button when video A is not in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should disable save button when video B is not in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: null,
        videoB: { metadata: { video_id: "temp-456", filename: "test2.mp4" } },
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should disable save button when only one video is in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: { metadata: { video_id: "temp-456", filename: "test2.mp4" } },
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should show tooltip when save button is disabled", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.getAttribute("title")).toBe("Save both videos to library before saving session");
    });

    it("should show different tooltip when save is enabled", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.getAttribute("title")).toBe("Save current analysis session");
    });

    it("should enable save button when both videos are in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: { metadata: { video_id: "lib-456", filename: "test2.mp4" } },
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }, { id: "lib-456" }],
        isVideoInLibrary: (id: string) => id === "lib-123" || id === "lib-456",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  describe("4.1.4 - Inline Message", () => {
    it("should not show inline message when all videos are in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      
      // Open the modal
      fireEvent.click(screen.getByText("💾 Save Session"));
      
      // Check that the inline message is not present
      expect(
        screen.queryByText("Save both videos to library before saving session")
      ).toBeNull();
    });
  });

  describe("4.1.5 - Button Highlighting via Props", () => {
    it("should accept videosNeedSaving prop", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      render(<SaveSessionPanel videosNeedSaving={true} />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should respect videosNeedSaving prop from parent", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      // Even though video is in library, prop says it needs saving
      render(<SaveSessionPanel videosNeedSaving={true} />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("4.1.6 - Session Save Disabled When Videos Not in Library", () => {
    it("should disable session save button when video A not in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should disable session save when temp video is loaded", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "temp-abc", filename: "temp.mp4" } },
        videoB: { metadata: { video_id: "temp-def", filename: "temp2.mp4" } },
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [],
        isVideoInLibrary: () => false,
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("4.1.7 - Session Save Enabled When Videos in Library", () => {
    it("should enable session save when both videos are in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: { metadata: { video_id: "lib-456", filename: "test2.mp4" } },
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }, { id: "lib-456" }],
        isVideoInLibrary: (id: string) => id === "lib-123" || id === "lib-456",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("should enable session save when single video is in library", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      const button = screen.getByText("💾 Save Session") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("should allow saving session when all videos are in library", async () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      mockSaveSession.mockResolvedValue(undefined);
      
      render(<SaveSessionPanel />);
      
      // Open the modal
      fireEvent.click(screen.getByText("💾 Save Session"));
      
      // Fill in the session name
      const nameInput = screen.getByPlaceholderText(
        "e.g. Driver practice 2024-06-01"
      );
      fireEvent.change(nameInput, { target: { value: "Test Session" } });
      
      // Submit the form
      const saveButton = screen.getByRole("button", { name: /Save$/i }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockSaveSession).toHaveBeenCalledWith("Test Session", undefined);
      });
    });

    it("should show success message after saving session", async () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      mockSaveSession.mockResolvedValue(undefined);
      
      render(<SaveSessionPanel />);
      
      // Open the modal
      fireEvent.click(screen.getByText("💾 Save Session"));
      
      // Fill in the session name
      const nameInput = screen.getByPlaceholderText(
        "e.g. Driver practice 2024-06-01"
      );
      fireEvent.change(nameInput, { target: { value: "Test Session" } });
      
      // Submit the form
      const saveButton = screen.getByRole("button", { name: /Save$/i }) as HTMLButtonElement;
      fireEvent.click(saveButton);
      
      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText("✓ Session saved!")).toBeTruthy();
      });
    });
  });

  describe("Session Save Functionality", () => {
    it("should open modal when save button is clicked", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      
      fireEvent.click(screen.getByText("💾 Save Session"));
      expect(screen.getByText("Save Analysis Session")).toBeTruthy();
    });

    it("should close modal when Cancel is clicked", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      
      fireEvent.click(screen.getByText("💾 Save Session"));
      expect(screen.getByText("Save Analysis Session")).toBeTruthy();
      
      fireEvent.click(screen.getByText("Cancel"));
      expect(
        screen.queryByText("Save Analysis Session")
      ).toBeNull();
    });

    it("should not submit without session name", () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      render(<SaveSessionPanel />);
      
      fireEvent.click(screen.getByText("💾 Save Session"));
      
      const saveButton = screen.getByRole("button", { name: /Save$/i }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it("should call saveSession with name and notes", async () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      mockSaveSession.mockResolvedValue(undefined);
      
      render(<SaveSessionPanel />);
      
      fireEvent.click(screen.getByText("💾 Save Session"));
      
      // Fill in the form
      fireEvent.change(
        screen.getByPlaceholderText("e.g. Driver practice 2024-06-01"),
        { target: { value: "My Session" } }
      );
      fireEvent.change(screen.getByPlaceholderText("Optional notes…"), {
        target: { value: "Some notes" },
      });
      
      // Submit
      fireEvent.click(screen.getByRole("button", { name: /Save$/i }));
      
      await waitFor(() => {
        expect(mockSaveSession).toHaveBeenCalledWith("My Session", "Some notes");
      });
    });

    it("should handle save errors", async () => {
      vi.spyOn(videoStore, "useVideoStore").mockReturnValue({
        videoA: { metadata: { video_id: "lib-123", filename: "test.mp4" } },
        videoB: null,
      } as any);
      
      vi.spyOn(libraryStore, "useLibraryStore").mockReturnValue({
        videos: [{ id: "lib-123" }],
        isVideoInLibrary: (id: string) => id === "lib-123",
      } as any);
      
      mockSaveSession.mockRejectedValue(new Error("Database error"));
      
      render(<SaveSessionPanel />);
      
      fireEvent.click(screen.getByText("💾 Save Session"));
      
      // Fill in the form
      fireEvent.change(
        screen.getByPlaceholderText("e.g. Driver practice 2024-06-01"),
        { target: { value: "My Session" } }
      );
      
      // Submit
      fireEvent.click(screen.getByRole("button", { name: /Save$/i }));
      
      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText("Database error")).toBeTruthy();
      });
    });
  });
});
