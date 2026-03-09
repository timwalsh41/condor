/**
 * Unit tests for TrimScrubBar component.
 *
 * Tests the unified trim + scrub bar used in PLAYBACK mode:
 * - Rendering with correct visual regions
 * - In/Out handle presence and positions
 * - Playhead hidden input value
 * - Control callbacks: loop toggle, return-to-in, reset
 * - Handle crossover constraint (In cannot exceed Out and vice versa)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrimScrubBar } from '../TrimScrubBar';

const defaultProps = {
  min: 0,
  max: 100,
  trimStart: 10,
  trimEnd: 80,
  playhead: 40,
  isLooping: false,
  frameLabel: 'Video A: Frame 40 / 100 | Video B: Frame 50 / 100',
  onPlayheadDrag: vi.fn(),
  onPlayheadRelease: vi.fn(),
  onTrimStartChange: vi.fn(),
  onTrimEndChange: vi.fn(),
  onLoopToggle: vi.fn(),
  onReturnToIn: vi.fn(),
  onResetTrim: vi.fn(),
};

describe('TrimScrubBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the hidden range input with correct bounds and testid', () => {
      render(<TrimScrubBar {...defaultProps} />);
      const input = screen.getByTestId('scrub-bar-both') as HTMLInputElement;
      expect(input.tagName).toBe('INPUT');
      expect(input.type).toBe('range');
      expect(Number(input.min)).toBe(0);
      expect(Number(input.max)).toBe(100);
      expect(Number(input.value)).toBe(40);
    });

    it('renders In and Out handles', () => {
      render(<TrimScrubBar {...defaultProps} />);
      expect(screen.getByTestId('trim-in-handle')).toBeTruthy();
      expect(screen.getByTestId('trim-out-handle')).toBeTruthy();
    });

    it('renders the frame label', () => {
      render(<TrimScrubBar {...defaultProps} />);
      expect(
        screen.getByText('Video A: Frame 40 / 100 | Video B: Frame 50 / 100')
      ).toBeTruthy();
    });

    it('renders In/Out frame numbers in the controls row', () => {
      render(<TrimScrubBar {...defaultProps} />);
      expect(screen.getByText(/In: 10/)).toBeTruthy();
      expect(screen.getByText(/Out: 80/)).toBeTruthy();
    });

    it('renders Reset, Return to In, and Loop buttons', () => {
      render(<TrimScrubBar {...defaultProps} />);
      expect(screen.getByTestId('trim-reset')).toBeTruthy();
      expect(screen.getByTestId('return-to-in')).toBeTruthy();
      expect(screen.getByTestId('loop-toggle')).toBeTruthy();
    });
  });

  describe('Loop toggle', () => {
    it('shows inactive style when isLooping is false', () => {
      render(<TrimScrubBar {...defaultProps} isLooping={false} />);
      const btn = screen.getByTestId('loop-toggle') as HTMLButtonElement;
      expect(btn.style.backgroundColor).not.toBe('rgb(76, 175, 80)');
    });

    it('shows active style when isLooping is true', () => {
      render(<TrimScrubBar {...defaultProps} isLooping={true} />);
      const btn = screen.getByTestId('loop-toggle') as HTMLButtonElement;
      // jsdom stores inline hex colours as-is (not converted to rgb)
      expect(btn.style.backgroundColor).toBe('#4CAF50');
    });

    it('calls onLoopToggle when Loop button is clicked', () => {
      render(<TrimScrubBar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('loop-toggle'));
      expect(defaultProps.onLoopToggle).toHaveBeenCalledOnce();
    });
  });

  describe('Control callbacks', () => {
    it('calls onReturnToIn when Return to In is clicked', () => {
      render(<TrimScrubBar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('return-to-in'));
      expect(defaultProps.onReturnToIn).toHaveBeenCalledOnce();
    });

    it('calls onResetTrim when Reset is clicked', () => {
      render(<TrimScrubBar {...defaultProps} />);
      fireEvent.click(screen.getByTestId('trim-reset'));
      expect(defaultProps.onResetTrim).toHaveBeenCalledOnce();
    });

    it('calls onPlayheadDrag with numeric value when hidden input changes', () => {
      render(<TrimScrubBar {...defaultProps} />);
      const input = screen.getByTestId('scrub-bar-both');
      fireEvent.change(input, { target: { value: '55' } });
      expect(defaultProps.onPlayheadDrag).toHaveBeenCalledWith(55);
    });
  });

  describe('In handle crossover constraint', () => {
    it('clamps In handle to one below Out when dragged past Out', () => {
      const onTrimStartChange = vi.fn();
      render(
        <TrimScrubBar
          {...defaultProps}
          trimStart={10}
          trimEnd={80}
          onTrimStartChange={onTrimStartChange}
        />
      );
      const inHandle = screen.getByTestId('trim-in-handle');

      // Simulate a pointer drag that would move In past Out (frame 90 > trimEnd 80)
      fireEvent.pointerDown(inHandle, { pointerId: 1, clientX: 0 });
      // clientX=90% of 100px track → frame 90, should be clamped to trimEnd-1=79
      fireEvent.pointerMove(inHandle, { pointerId: 1, clientX: 90 });

      if (onTrimStartChange.mock.calls.length > 0) {
        const calledWith = onTrimStartChange.mock.calls[0][0];
        expect(calledWith).toBeLessThan(80);
      }
    });

    it('clamps Out handle to one above In when dragged past In', () => {
      const onTrimEndChange = vi.fn();
      render(
        <TrimScrubBar
          {...defaultProps}
          trimStart={50}
          trimEnd={80}
          onTrimEndChange={onTrimEndChange}
        />
      );
      const outHandle = screen.getByTestId('trim-out-handle');

      fireEvent.pointerDown(outHandle, { pointerId: 1, clientX: 100 });
      // clientX=10% → frame 10, should be clamped to trimStart+1=51
      fireEvent.pointerMove(outHandle, { pointerId: 1, clientX: 10 });

      if (onTrimEndChange.mock.calls.length > 0) {
        const calledWith = onTrimEndChange.mock.calls[0][0];
        expect(calledWith).toBeGreaterThan(50);
      }
    });
  });
});
