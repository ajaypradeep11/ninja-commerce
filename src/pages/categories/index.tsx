import { GripVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
  onDelete: () => void;
}

function CategoryRow({ cat, handleProps, onRename, onDelete }: CategoryRowProps) {
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
              onDelete={() => remove.mutate(cat.id, { onError: errorToast })}
            />
          )}
        />
      </div>
    </div>
  );
}
