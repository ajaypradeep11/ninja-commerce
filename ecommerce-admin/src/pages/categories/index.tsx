import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { GripVertical, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { storage } from '@/auth/firebase';
import { optimizeProductImage } from '@/lib/optimize-product-image';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from '@/api/hooks/categories';
import type { ApiError } from '@/api/unwrap';
import type { CategoryResponseDto } from '@/api/generated/types.gen';
import { SortableList, type DragHandleProps } from '@/components/SortableList';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { slugify } from '@/lib/slugify';

function errorToast(e: unknown) {
  toast.error((e as ApiError).message ?? 'Something went wrong');
}

interface CategoryRowProps {
  cat: CategoryResponseDto;
  handleProps: DragHandleProps;
  onRename: (name: string) => void;
  onImageChange: (imageUrl: string | null) => void;
  onDelete: () => void;
}

/**
 * Tile artwork for the storefront's category grid. Same upload path as brand
 * logos, so the existing storage rules cover it; a category with no image
 * falls back to its name on the storefront.
 */
function CategoryImageControl({
  cat,
  onImageChange,
}: {
  cat: CategoryResponseDto;
  onImageChange: (imageUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeProductImage(file);
      const storageRef = ref(
        storage,
        `products/category-${crypto.randomUUID()}.webp`,
      );
      await uploadBytes(storageRef, optimized, {
        contentType: 'image/webp',
        cacheControl: 'public,max-age=31536000,immutable',
      });
      onImageChange(await getDownloadURL(storageRef));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Image upload failed.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files)}
      />
      {cat.imageUrl ? (
        <>
          <img
            src={cat.imageUrl}
            alt={`${cat.name} tile`}
            className="h-8 w-8 rounded border bg-black object-cover"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${cat.name} image`}
            onClick={() => onImageChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          aria-label={`Upload ${cat.name} image`}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          Image
        </Button>
      )}
    </div>
  );
}

function CategoryRow({
  cat,
  handleProps,
  onRename,
  onImageChange,
  onDelete,
}: CategoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);

  function commit() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== cat.name) {
      onRename(trimmed);
    } else {
      setName(cat.name);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-background p-2">
      <button
        type="button"
        {...handleProps}
        className="cursor-grab text-muted-foreground"
        aria-label={`Reorder ${cat.name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {editing ? (
        <Input
          autoFocus
          value={name}
          className="h-8"
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      ) : (
        <button
          type="button"
          className="h-8 flex-1 truncate rounded px-2 text-left text-sm hover:bg-accent"
          onClick={() => setEditing(true)}
        >
          {cat.name}
        </button>
      )}
      <span className="w-32 truncate text-xs text-muted-foreground">
        /{cat.slug}
      </span>
      <CategoryImageControl cat={cat} onImageChange={onImageChange} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Delete ${cat.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{cat.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Categories that still contain products cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CategoriesPage() {
  const { data: categories, isLoading, error } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const reorder = useReorderCategories();
  const [newName, setNewName] = useState('');

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return <div className="text-destructive">Failed to load categories.</div>;

  function onAdd() {
    const name = newName.trim();
    if (!name) return;
    create.mutate(
      { name, slug: slugify(name) },
      {
        onSuccess: () => setNewName(''),
        onError: errorToast,
      },
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Categories</h1>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
        <Button onClick={onAdd} disabled={create.isPending}>
          Add
        </Button>
      </div>

      <div className="grid gap-2">
        <SortableList
          items={categories ?? []}
          getId={(c) => c.id}
          onReorder={(ordered) =>
            reorder.mutate(ordered, { onError: errorToast })
          }
          renderItem={(cat, handleProps) => (
            <CategoryRow
              cat={cat}
              handleProps={handleProps}
              onRename={(name) =>
                update.mutate({ id: cat.id, body: { name } }, { onError: errorToast })
              }
              onImageChange={(imageUrl) =>
                update.mutate(
                  { id: cat.id, body: { imageUrl } },
                  { onError: errorToast },
                )
              }
              onDelete={() => remove.mutate(cat.id, { onError: errorToast })}
            />
          )}
        />
      </div>
    </div>
  );
}
