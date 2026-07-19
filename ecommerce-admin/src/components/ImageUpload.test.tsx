import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

const refPaths: string[] = [];
const uploadBytes = vi.fn((..._args: unknown[]) => Promise.resolve({}));
const optimizeProductImage = vi.fn(
  async (_file: File) => new Blob(['optimized'], { type: 'image/webp' }),
);

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => {
    refPaths.push(path);
    return { path };
  },
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
  getDownloadURL: async (r: { path: string }) => `https://cdn/${r.path}`,
}));

vi.mock('@/auth/firebase', () => ({ storage: {} }));
vi.mock('@/lib/optimize-product-image', () => ({
  optimizeProductImage: (file: File) => optimizeProductImage(file),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));

import { ImageUpload } from './ImageUpload';

function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div>
      <ImageUpload value={value} onChange={setValue} />
      <span data-testid="count">{value.length}</span>
    </div>
  );
}

function getInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    value: files,
    configurable: true,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  refPaths.length = 0;
  uploadBytes.mockClear();
  optimizeProductImage.mockClear();
  toastError.mockClear();
});

describe('ImageUpload validation and optimization', () => {
  it('uploads an optimized WebP with a safe key and cache metadata', async () => {
    render(<Harness />);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    expect(refPaths).toHaveLength(1);
    const key = refPaths[0];
    expect(key).toMatch(/^products\/[^/]+\.webp$/);
    expect(optimizeProductImage).toHaveBeenCalledWith(file);
    expect(uploadBytes).toHaveBeenCalledWith(
      { path: key },
      expect.objectContaining({ type: 'image/webp' }),
      {
        contentType: 'image/webp',
        cacheControl: 'public,max-age=31536000,immutable',
      },
    );
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    );
  });

  it('ignores an attacker-controlled file name', async () => {
    render(<Harness />);
    const file = new File(['x'], '../../evil/pwn.png', { type: 'image/png' });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    expect(refPaths[0]).not.toContain('evil');
    expect(refPaths[0]).toMatch(/^products\/[^/]+\.webp$/);
  });

  it('rejects a non-image file without processing or uploading it', async () => {
    render(<Harness />);
    const file = new File(['x'], 'malware.svg', { type: 'image/svg+xml' });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(optimizeProductImage).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('accepts a 7MB source image and uploads its optimized output', async () => {
    render(<Harness />);
    const file = new File(['x'], 'large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 7 * 1024 * 1024 });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    expect(optimizeProductImage).toHaveBeenCalledWith(file);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('rejects a source image that is 15MB or larger', async () => {
    render(<Harness />);
    const file = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(optimizeProductImage).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('does not offer an unoptimized pasted-URL path', () => {
    render(<Harness />);

    expect(screen.queryByPlaceholderText(/paste image url/i)).toBeNull();
  });
});
