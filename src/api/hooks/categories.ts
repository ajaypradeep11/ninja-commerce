import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  categoriesControllerCreate,
  categoriesControllerFindAll,
  categoriesControllerRemove,
  categoriesControllerUpdate,
} from '../generated/sdk.gen';
import type {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../generated/types.gen';
import { unwrap } from '../unwrap';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => unwrap(categoriesControllerFindAll()),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCategoryDto) =>
      unwrap(categoriesControllerCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCategoryDto }) =>
      unwrap(categoriesControllerUpdate({ path: { id }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(categoriesControllerRemove({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ordered: CategoryResponseDto[]) =>
      Promise.all(
        ordered.map((cat, index) =>
          cat.sortOrder === index
            ? Promise.resolve(null)
            : unwrap(
                categoriesControllerUpdate({
                  path: { id: cat.id },
                  body: { sortOrder: index },
                }),
              ),
        ),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
