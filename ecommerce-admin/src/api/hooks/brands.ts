import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  brandsControllerCreate,
  brandsControllerFindAll,
  brandsControllerRemove,
  brandsControllerUpdate,
} from '../generated/sdk.gen';
import type {
  BrandResponseDto,
  CreateBrandDto,
  UpdateBrandDto,
} from '../generated/types.gen';
import { unwrap } from '../unwrap';

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => unwrap(brandsControllerFindAll()),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBrandDto) =>
      unwrap(brandsControllerCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBrandDto }) =>
      unwrap(brandsControllerUpdate({ path: { id }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(brandsControllerRemove({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useReorderBrands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ordered: BrandResponseDto[]) =>
      Promise.all(
        ordered.map((brand, index) =>
          brand.sortOrder === index
            ? Promise.resolve(null)
            : unwrap(
                brandsControllerUpdate({
                  path: { id: brand.id },
                  body: { sortOrder: index },
                }),
              ),
        ),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}
