import { GripVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
  onDelete: () => void;
}

function BrandRow({ brand, handleProps, onRename, onDelete }: BrandRowProps) {
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
              onDelete={() => remove.mutate(brand.id, { onError: errorToast })}
            />
          )}
        />
      </div>
    </div>
  );
}
