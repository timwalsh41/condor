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
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      arcTo: () => {},
      isPointInPath: () => false,
      isPointInStroke: () => false,
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
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
