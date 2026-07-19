import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  couponsControllerCreate,
  couponsControllerFindAll,
  couponsControllerRemove,
  couponsControllerUpdate,
} from '../generated/sdk.gen';
import type { CreateCouponDto, UpdateCouponDto } from '../generated/types.gen';
import { unwrap } from '../unwrap';

export function useCoupons() {
  return useQuery({
    queryKey: ['coupons'],
    queryFn: () => unwrap(couponsControllerFindAll()),
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCouponDto) =>
      unwrap(couponsControllerCreate({ body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCouponDto }) =>
      unwrap(couponsControllerUpdate({ path: { id }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(couponsControllerRemove({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
}
