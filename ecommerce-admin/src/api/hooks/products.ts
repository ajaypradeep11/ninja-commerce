import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  productsControllerBulkCreate,
  productsControllerCreate,
  productsControllerFindAll,
  productsControllerFindByIdAdmin,
  productsControllerUpdate,
} from '../generated/sdk.gen';
import type {
  BulkUploadProductsDto,
  CreateProductDto,
  UpdateProductDto,
} from '../generated/types.gen';
import { unwrap } from '../unwrap';

export interface ProductListParams {
  q?: string;
  category?: string;
  page: number;
  all: boolean;
}

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () =>
      unwrap(
        productsControllerFindAll({
          query: {
            page: params.page,
            pageSize: 20,
            ...(params.q ? { q: params.q } : {}),
            ...(params.category ? { category: params.category } : {}),
            ...(params.all ? { all: true } : {}),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => unwrap(productsControllerFindByIdAdmin({ path: { id } })),
    enabled: id !== '',
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductDto) =>
      unwrap(productsControllerCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useBulkCreateProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkUploadProductsDto) =>
      unwrap(productsControllerBulkCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductDto }) =>
      unwrap(productsControllerUpdate({ path: { id }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
