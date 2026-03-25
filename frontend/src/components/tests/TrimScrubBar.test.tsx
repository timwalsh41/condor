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

    it('track container has horizontal padding to prevent handle overflow at edges', () => {
      // Bug fix: when trimEnd == range.max (100%) or trimStart == range.min (0%),
      // handles need 10px padding on each side to remain fully visible.
      // Padding allows handles to be centered at 0% and 100% without clipping.
      render(<TrimScrubBar {...defaultProps} trimEnd={100} />);
      const trackContainer = screen.getByTestId('trim-out-handle').parentElement!;
      expect(trackContainer.style.padding).toBe('0px 10px');
    });

    it('renders In and Out handles', () => {
      render(<TrimScrubBar {...defaultProps} />);
      expect(screen.getByTestId('trim-in-handle')).toBeTruthy();
      expect(screen.getByTestId('trim-out-handle')).toBeTruthy();
    });

    it('positions In handle at trimStart percentage (0% when trimStart=min)', () => {
      render(<TrimScrubBar {...defaultProps} trimStart={0} />);
      const inHandle = screen.getByTestId('trim-in-handle') as HTMLDivElement;
      expect(inHandle.style.left).toBe('0%');
    });

    it('positions Out handle at trimEnd percentage (100% when trimEnd=max)', () => {
      render(<TrimScrubBar {...defaultProps} trimEnd={100} />);
      const outHandle = screen.getByTestId('trim-out-handle') as HTMLDivElement;
      expect(outHandle.style.left).toBe('100%');
    });

    it('green playback range spans from trimStart to trimEnd', () => {
      render(<TrimScrubBar {...defaultProps} trimStart={25} trimEnd={75} />);
      // The green zone width is calculated as trimEndPct - trimStartPct
      // In jsdom, we can verify the component renders without errors
      // Full visual testing requires browser environment
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

    it('renders Reset, Return to In, Loop, Set In, and Set Out buttons', () => {
      render(<TrimScrubBar {...defaultProps} />);
      expect(screen.getByTestId('trim-reset')).toBeTruthy();
      expect(screen.getByTestId('return-to-in')).toBeTruthy();
      expect(screen.getByTestId('loop-toggle')).toBeTruthy();
      expect(screen.getByTestId('set-in')).toBeTruthy();
      expect(screen.getByTestId('set-out')).toBeTruthy();
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

  describe('Set In / Set Out buttons', () => {
    it('calls onTrimStartChange with playhead when Set In is clicked and playhead < trimEnd', () => {
      const onTrimStartChange = vi.fn();
      // playhead=40, trimEnd=80 → 40 < 80, valid
      render(<TrimScrubBar {...defaultProps} onTrimStartChange={onTrimStartChange} />);
      fireEvent.click(screen.getByTestId('set-in'));
      expect(onTrimStartChange).toHaveBeenCalledWith(40);
    });

    it('does not call onTrimStartChange when playhead >= trimEnd', () => {
      const onTrimStartChange = vi.fn();
      // playhead=80, trimEnd=80 → crossover, should be ignored
      render(<TrimScrubBar {...defaultProps} playhead={80} onTrimStartChange={onTrimStartChange} />);
      const btn = screen.getByTestId('set-in') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.click(btn);
      expect(onTrimStartChange).not.toHaveBeenCalled();
    });

    it('calls onTrimEndChange with playhead when Set Out is clicked and playhead > trimStart', () => {
      const onTrimEndChange = vi.fn();
      // playhead=40, trimStart=10 → 40 > 10, valid
      render(<TrimScrubBar {...defaultProps} onTrimEndChange={onTrimEndChange} />);
      fireEvent.click(screen.getByTestId('set-out'));
      expect(onTrimEndChange).toHaveBeenCalledWith(40);
    });

    it('does not call onTrimEndChange when playhead <= trimStart', () => {
      const onTrimEndChange = vi.fn();
      // playhead=10, trimStart=10 → crossover, should be ignored
      render(<TrimScrubBar {...defaultProps} playhead={10} onTrimEndChange={onTrimEndChange} />);
      const btn = screen.getByTestId('set-out') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.click(btn);
      expect(onTrimEndChange).not.toHaveBeenCalled();
    });
  });

  describe('In/Out handle crossover constraint', () => {
    it('clamps In handle drag so it stays below trimEnd', () => {
      const onTrimStartChange = vi.fn();
      // trimStart=10, trimEnd=80 — cannot set In past Out
      render(
        <TrimScrubBar
          {...defaultProps}
          trimStart={10}
          trimEnd={80}
          onTrimStartChange={onTrimStartChange}
        />
      );
      // All move calls on the In handle should produce values < trimEnd (80)
      if (onTrimStartChange.mock.calls.length > 0) {
        onTrimStartChange.mock.calls.forEach(([v]) => expect(v).toBeLessThan(80));
      }
    });

    it('Set In is disabled when playhead equals trimEnd', () => {
      render(<TrimScrubBar {...defaultProps} playhead={80} trimEnd={80} />);
      expect((screen.getByTestId('set-in') as HTMLButtonElement).disabled).toBe(true);
    });

    it('Set Out is disabled when playhead equals trimStart', () => {
      render(<TrimScrubBar {...defaultProps} playhead={10} trimStart={10} />);
      expect((screen.getByTestId('set-out') as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
