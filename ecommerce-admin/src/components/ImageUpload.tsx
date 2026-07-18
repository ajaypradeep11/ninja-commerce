import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { GripVertical, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { storage } from '@/auth/firebase';
import { SortableList } from '@/components/SortableList';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  value: string[];
  onChange: (next: string[]) => void;
}

// Keep this allowlist in sync with the contentType matcher in storage.rules.
// Maps an accepted browser content-type to the safe extension used in the key.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;

    // The <input accept="image/*"> is only a UI hint — enforce the same
    // constraints as storage.rules here so we never attempt a rejected upload.
    const valid: { file: File; ext: string }[] = [];
    for (const file of Array.from(files)) {
      const ext = ALLOWED_IMAGE_TYPES[file.type];
      if (!ext) {
        toast.error(`"${file.name}" is not a supported image type.`);
        continue;
      }
      if (file.size >= MAX_IMAGE_BYTES) {
        toast.error(`"${file.name}" is larger than 5MB.`);
        continue;
      }
      valid.push({ file, ext });
    }
    if (!valid.length) {
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const urls = await Promise.all(
        valid.map(async ({ file, ext }) => {
          // Never interpolate file.name (attacker-controlled, may contain "/"
          // for path traversal). Build a single-segment key from a random id
          // plus a safe extension derived from the validated content-type.
          const storageRef = ref(
            storage,
            `products/${crypto.randomUUID()}.${ext}`,
          );
          await uploadBytes(storageRef, file);
          return getDownloadURL(storageRef);
        }),
      );
      onChange([...value, ...urls]);
    } catch {
      toast.error('Image upload failed.');
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
    </div>
  );
}
