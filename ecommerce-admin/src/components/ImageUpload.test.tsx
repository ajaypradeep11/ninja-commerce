import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

const refPaths: string[] = [];
const uploadBytes = vi.fn((..._args: unknown[]) => Promise.resolve({}));

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => {
    refPaths.push(path);
    return { path };
  },
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
  getDownloadURL: async (r: { path: string }) => `https://cdn/${r.path}`,
}));

vi.mock('@/auth/firebase', () => ({ storage: {} }));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));

import { ImageUpload } from './ImageUpload';

// Thin wrapper so onChange is wired to real state and the input is reachable.
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
  // The file input is hidden; grab it directly.
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
  toastError.mockClear();
});

describe('ImageUpload validation', () => {
  it('uploads a valid image with a single-segment, slash-free key', async () => {
    render(<Harness />);
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    expect(refPaths).toHaveLength(1);
    const key = refPaths[0];
    // Exactly one slash: the "products/" prefix, nothing after the id.
    expect(key.startsWith('products/')).toBe(true);
    expect(key.slice('products/'.length)).not.toContain('/');
    expect(key).toMatch(/^products\/[^/]+\.png$/);
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    );
  });

  it('ignores the attacker-controlled file name (no path traversal)', async () => {
    render(<Harness />);
    const file = new File(['x'], '../../evil/pwn.png', { type: 'image/png' });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    expect(refPaths[0]).not.toContain('evil');
    expect(refPaths[0]).toMatch(/^products\/[^/]+\.png$/);
  });

  it('rejects a non-image file and does not upload', async () => {
    render(<Harness />);
    const file = new File(['x'], 'malware.svg', { type: 'image/svg+xml' });
    setFiles(getInput(), [file]);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(refPaths).toHaveLength(0);
  });

  it('rejects a file that is 5MB or larger and does not upload', async () => {
    render(<Harness />);
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 });
    setFiles(getInput(), [big]);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});

describe('ImageUpload add-by-URL', () => {
  it('adds a pasted https URL without touching storage and clears the input', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText(/paste image url/i);

    await user.type(input, 'https://cdn.example.com/lamp.jpg');
    await user.click(screen.getByRole('button', { name: /add url/i }));

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByText('https://cdn.example.com/lamp.jpg')).toBeTruthy();
    expect(uploadBytes).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('adds on Enter without submitting an enclosing form', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );

    await user.type(
      screen.getByPlaceholderText(/paste image url/i),
      'https://cdn.example.com/a.png{Enter}',
    );

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a non-http(s) URL with an error toast', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(
      screen.getByPlaceholderText(/paste image url/i),
      'javascript:alert(1)',
    );
    await user.click(screen.getByRole('button', { name: /add url/i }));

    expect(toastError).toHaveBeenCalled();
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('rejects garbage that is not a URL at all', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(
      screen.getByPlaceholderText(/paste image url/i),
      'not a url',
    );
    await user.click(screen.getByRole('button', { name: /add url/i }));

    expect(toastError).toHaveBeenCalled();
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('ignores a duplicate URL already in the list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText(/paste image url/i);
    const add = screen.getByRole('button', { name: /add url/i });

    await user.type(input, 'https://cdn.example.com/x.png');
    await user.click(add);
    await user.type(input, 'https://cdn.example.com/x.png');
    await user.click(add);

    expect(toastError).toHaveBeenCalled();
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
