import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fitImageDimensions,
  optimizeProductImage,
} from './optimize-product-image';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function webpWithSize(size: number) {
  const blob = new Blob(['x'], { type: 'image/webp' });
  Object.defineProperty(blob, 'size', { value: size });
  return blob;
}

function mockBitmap(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() } as unknown as ImageBitmap;
  const create = vi.fn(async () => bitmap);
  vi.stubGlobal('createImageBitmap', create);
  return { bitmap, create };
}

function mockCanvas(outputs: Blob[]) {
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback) => callback(outputs.shift() ?? null));
  return { context, toBlob };
}

describe('fitImageDimensions', () => {
  it('shrinks a wide image to the 1600px width limit', () => {
    expect(fitImageDimensions(4000, 3000)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('shrinks a portrait image to the 2000px height limit', () => {
    expect(fitImageDimensions(3000, 4000)).toEqual({
      width: 1500,
      height: 2000,
    });
  });

  it('does not enlarge a small image', () => {
    expect(fitImageDimensions(800, 600)).toEqual({
      width: 800,
      height: 600,
    });
  });
});

describe('optimizeProductImage', () => {
  it('resizes a source image and encodes it as WebP', async () => {
    const { bitmap, create } = mockBitmap(4000, 3000);
    const { context, toBlob } = mockCanvas([webpWithSize(200_000)]);
    const file = new File(['source'], 'photo.jpg', { type: 'image/jpeg' });

    const result = await optimizeProductImage(file);

    expect(create).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    });
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/webp',
      0.82,
    );
    expect(result.type).toBe('image/webp');
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('reduces dimensions when quality changes alone cannot reach 750KB', async () => {
    const { bitmap } = mockBitmap(4000, 3000);
    const tooLarge = webpWithSize(800_000);
    const { context } = mockCanvas([
      tooLarge,
      tooLarge,
      tooLarge,
      tooLarge,
      webpWithSize(700_000),
    ]);
    const file = new File(['source'], 'photo.png', { type: 'image/png' });

    await optimizeProductImage(file);

    expect(context.drawImage).toHaveBeenNthCalledWith(
      1,
      bitmap,
      0,
      0,
      1600,
      1200,
    );
    expect(context.drawImage).toHaveBeenNthCalledWith(
      2,
      bitmap,
      0,
      0,
      1280,
      960,
    );
  });

  it('rejects browsers that cannot produce WebP', async () => {
    const { bitmap } = mockBitmap(800, 600);
    mockCanvas([new Blob(['x'], { type: 'image/png' })]);
    const file = new File(['source'], 'photo.png', { type: 'image/png' });

    await expect(optimizeProductImage(file)).rejects.toThrow(
      'does not support WebP conversion',
    );
    expect(bitmap.close).toHaveBeenCalled();
  });
});
