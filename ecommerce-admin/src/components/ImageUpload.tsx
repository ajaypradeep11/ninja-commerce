import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { GripVertical, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { storage } from '@/auth/firebase';
import { SortableList } from '@/components/SortableList';
import { Button } from '@/components/ui/button';
import { optimizeProductImage } from '@/lib/optimize-product-image';

interface ImageUploadProps {
  value: string[];
  onChange: (next: string[]) => void;
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;

    // The <input accept="image/*"> is only a UI hint. Validate source types
    // here; storage.rules separately validates the optimized WebP output.
    const valid: File[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error(`"${file.name}" is not a supported image type.`);
        continue;
      }
      if (file.size >= MAX_SOURCE_IMAGE_BYTES) {
        toast.error(`"${file.name}" is 15MB or larger.`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) {
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const urls: string[] = [];
      // Process sequentially to avoid holding several decoded 15MB images in
      // memory at once when an admin selects multiple files.
      for (const file of valid) {
        try {
          const optimized = await optimizeProductImage(file);
          const storageRef = ref(
            storage,
            `products/${crypto.randomUUID()}.webp`,
          );
          await uploadBytes(storageRef, optimized, {
            contentType: 'image/webp',
            cacheControl: 'public,max-age=31536000,immutable',
          });
          urls.push(await getDownloadURL(storageRef));
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : 'Image upload failed.';
          toast.error(`Could not upload "${file.name}": ${reason}`);
        }
      }
      if (urls.length) onChange([...value, ...urls]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2">
        <SortableList
          items={value.map((url, i) => ({ url, key: `${i}-${url}` }))}
          getId={(item) => item.key}
          onReorder={(items) => onChange(items.map((i) => i.url))}
          renderItem={(item, handleProps) => (
            <div className="flex items-center gap-2 rounded-md border p-2">
              <button
                type="button"
                {...handleProps}
                className="cursor-grab text-muted-foreground"
                aria-label="Reorder image"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <img
                src={item.url}
                alt=""
                className="h-12 w-12 rounded object-cover"
              />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {item.url}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove image"
                onClick={() => onChange(value.filter((u) => u !== item.url))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload images
      </Button>
      <p className="text-xs text-muted-foreground">
        PNG, JPEG, WebP, GIF, or AVIF up to 15MB. Images are resized and
        converted to WebP before upload.
      </p>
    </div>
  );
}
