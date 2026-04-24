/**
 * Vitest setup file.
 *
 * Provides minimal mocks for browser APIs that are missing in happy-dom,
 * primarily Canvas 2D rendering context needed by react-konva / Konva.
 */

HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === '2d') {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      ellipse: () => {},
      rect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      transform: () => {},
      setTransform: () => {},
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
      putImageData: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
      measureText: () => ({ width: 0 }),
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      canvas: this,
    } as unknown as CanvasRenderingContext2D;
  }
  return null;
};
