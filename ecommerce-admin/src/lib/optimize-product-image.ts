const MAX_WIDTH = 1600;
const MAX_HEIGHT = 2000;
const MAX_OUTPUT_BYTES = 750 * 1024;
const WEBP_QUALITIES = [0.82, 0.72, 0.62, 0.52];
const MAX_RESIZE_PASSES = 4;

export function fitImageDimensions(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const scale = Math.min(1, MAX_WIDTH / sourceWidth, MAX_HEIGHT / sourceHeight);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('This browser could not convert the image.'));
        } else if (blob.type !== 'image/webp') {
          reject(new Error('This browser does not support WebP conversion.'));
        } else {
          resolve(blob);
        }
      },
      'image/webp',
      quality,
    );
  });
}

export async function optimizeProductImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('The image could not be decoded.');
  }

  try {
    let { width, height } = fitImageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is not available.');

    for (let pass = 0; pass < MAX_RESIZE_PASSES; pass += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of WEBP_QUALITIES) {
        const output = await canvasToWebp(canvas, quality);
        if (output.size <= MAX_OUTPUT_BYTES) return output;
      }

      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }

    throw new Error('The optimized image is still larger than 750KB.');
  } finally {
    bitmap.close();
  }
}
