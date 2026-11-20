import {
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  WHEEL_STEP,
  ZOOM_STEP,
  clampPan,
  clampScale,
  pinchScale,
  toggleScale,
  wheelScale,
} from './image-zoom.model';

describe('image-zoom model', () => {
  describe('clampScale', () => {
    it('keeps values inside the 1x to 4x range', () => {
      expect(MIN_SCALE).toBe(1);
      expect(MAX_SCALE).toBe(4);
      expect(clampScale(0.3)).toBe(1);
      expect(clampScale(2)).toBe(2);
      expect(clampScale(9)).toBe(4);
    });

    it('falls back to 1x for non-finite values', () => {
      expect(clampScale(Number.NaN)).toBe(1);
      expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
    });
  });

  describe('clampPan', () => {
    const viewport = { width: 400, height: 300 };
    const image = { width: 400, height: 300 };

    it('allows no pan at 1x', () => {
      expect(clampPan({ x: 120, y: -80 }, 1, viewport, image)).toEqual({ x: 0, y: 0 });
    });

    it('limits the pan to half the overflow of the scaled image', () => {
      // At 2x the image is 800x600: it overflows 400x300, so ±200 / ±150.
      expect(clampPan({ x: 500, y: -500 }, 2, viewport, image)).toEqual({ x: 200, y: -150 });
      expect(clampPan({ x: 50, y: 20 }, 2, viewport, image)).toEqual({ x: 50, y: 20 });
    });

    it('locks an axis where the scaled image still fits', () => {
      const tall = { width: 100, height: 300 };
      // 2x → 200x600: fits horizontally, overflows vertically by 300.
      expect(clampPan({ x: 90, y: 400 }, 2, viewport, tall)).toEqual({ x: 0, y: 150 });
    });

    it('recovers from a NaN pan', () => {
      expect(clampPan({ x: Number.NaN, y: 20 }, 2, viewport, image)).toEqual({ x: 0, y: 20 });
    });

    it('allows no pan when sizes are unknown', () => {
      expect(clampPan({ x: 30, y: 30 }, 3, { width: 0, height: 0 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
    });
  });

  describe('wheelScale', () => {
    it('zooms in on wheel up and out on wheel down by one step', () => {
      expect(wheelScale(1, -100)).toBeCloseTo(1 + WHEEL_STEP);
      expect(wheelScale(2, 100)).toBeCloseTo(2 - WHEEL_STEP);
    });

    it('zooms in proportion to small deltas, so a trackpad pinch is not too fast', () => {
      expect(wheelScale(1, -10)).toBeCloseTo(1 + WHEEL_STEP / 10);
      expect(wheelScale(2, 4)).toBeCloseTo(2 - (WHEEL_STEP * 4) / 100);
    });

    it('caps one event at one step', () => {
      expect(wheelScale(1, -1000)).toBeCloseTo(1 + WHEEL_STEP);
    });

    it('ignores a zero delta and clamps at the limits', () => {
      expect(wheelScale(2, 0)).toBe(2);
      expect(wheelScale(MAX_SCALE, -100)).toBe(MAX_SCALE);
      expect(wheelScale(MIN_SCALE, 100)).toBe(MIN_SCALE);
    });
  });

  describe('pinchScale', () => {
    it('scales proportionally to the finger distance, clamped', () => {
      expect(pinchScale(1, 100, 200)).toBe(2);
      expect(pinchScale(2, 100, 50)).toBe(1);
      expect(pinchScale(3, 100, 400)).toBe(4);
    });

    it('keeps the start scale when the start distance is zero', () => {
      expect(pinchScale(2, 0, 100)).toBe(2);
    });
  });

  describe('toggleScale', () => {
    it('goes from 1x to the double-tap scale and back', () => {
      expect(DOUBLE_TAP_SCALE).toBe(2.5);
      expect(toggleScale(1)).toBe(DOUBLE_TAP_SCALE);
      expect(toggleScale(1.5)).toBe(1);
      expect(toggleScale(4)).toBe(1);
    });
  });

  it('uses a positive button step', () => {
    expect(ZOOM_STEP).toBeGreaterThan(0);
  });
});
