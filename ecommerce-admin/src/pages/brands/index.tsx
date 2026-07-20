import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { GripVertical, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { storage } from '@/auth/firebase';
import { optimizeProductImage } from '@/lib/optimize-product-image';
import {
  useBrands,
  useCreateBrand,
  useDeleteBrand,
  useReorderBrands,
  useUpdateBrand,
} from '@/api/hooks/brands';
import type { ApiError } from '@/api/unwrap';
import type { BrandResponseDto } from '@/api/generated/types.gen';
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

interface BrandRowProps {
  brand: BrandResponseDto;
  handleProps: DragHandleProps;
  onRename: (name: string) => void;
  onLogoChange: (logoUrl: string | null) => void;
  onDelete: () => void;
}

function BrandLogoControl({
  brand,
  onLogoChange,
}: {
  brand: BrandResponseDto;
  onLogoChange: (logoUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeProductImage(file);
      // Reuses the products/ path so the existing storage rules apply.
      const storageRef = ref(storage, `products/brand-${crypto.randomUUID()}.webp`);
      await uploadBytes(storageRef, optimized, {
        contentType: 'image/webp',
        cacheControl: 'public,max-age=31536000,immutable',
      });
      onLogoChange(await getDownloadURL(storageRef));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Logo upload failed.',
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
      {brand.logoUrl ? (
        <>
          <img
            src={brand.logoUrl}
            alt={`${brand.name} logo`}
            className="h-8 w-14 rounded border bg-black object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${brand.name} logo`}
            onClick={() => onLogoChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          aria-label={`Upload ${brand.name} logo`}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          Logo
        </Button>
      )}
    </div>
  );
}

function BrandRow({
  brand,
  handleProps,
  onRename,
  onLogoChange,
  onDelete,
}: BrandRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);

  function commit() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== brand.name) {
      onRename(trimmed);
    } else {
      setName(brand.name);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-background p-2">
      <button
        type="button"
        {...handleProps}
        className="cursor-grab text-muted-foreground"
        aria-label={`Reorder ${brand.name}`}
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
          {brand.name}
        </button>
      )}
      <span className="w-32 truncate text-xs text-muted-foreground">
        /{brand.slug}
      </span>
      <BrandLogoControl brand={brand} onLogoChange={onLogoChange} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Delete ${brand.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{brand.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Products tagged with this brand keep existing — they just lose the
              brand tag.
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

export function BrandsPage() {
  const { data: brands, isLoading, error } = useBrands();
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const remove = useDeleteBrand();
  const reorder = useReorderBrands();
  const [newName, setNewName] = useState('');

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return <div className="text-destructive">Failed to load brands.</div>;

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
      <h1 className="mb-6 text-2xl font-semibold">Brands</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Franchises/anime your products belong to (shown as “Anime” in the store).
      </p>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="New brand name"
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
          items={brands ?? []}
          getId={(b) => b.id}
          onReorder={(ordered) =>
            reorder.mutate(ordered, { onError: errorToast })
          }
          renderItem={(brand, handleProps) => (
            <BrandRow
              brand={brand}
              handleProps={handleProps}
              onRename={(name) =>
                update.mutate(
                  { id: brand.id, body: { name } },
                  { onError: errorToast },
                )
              }
              onLogoChange={(logoUrl) =>
                update.mutate(
                  { id: brand.id, body: { logoUrl } },
                  { onError: errorToast },
                )
              }
              onDelete={() => remove.mutate(brand.id, { onError: errorToast })}
            />
          )}
        />
      </div>
    </div>
  );
}
