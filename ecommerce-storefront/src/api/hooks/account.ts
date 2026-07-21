import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ordersControllerCancel,
  ordersControllerFindMine,
  ordersControllerFindOne,
  ordersControllerRequestReturn,
  usersControllerGetMe,
  usersControllerUpdateAddresses,
  type AddressDto,
} from '@/api/generated';
import { unwrap } from '@/api/unwrap';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap(usersControllerGetMe()),
  });
}

export function useUpdateAddresses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addresses: AddressDto[]) =>
      unwrap(usersControllerUpdateAddresses({ body: { addresses } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['orders', 'me'],
    queryFn: () => unwrap(ordersControllerFindMine()),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => unwrap(ordersControllerFindOne({ path: { id } })),
    enabled: !!id,
  });
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(ordersControllerCancel({ path: { id } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRequestReturn(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      unwrap(ordersControllerRequestReturn({ path: { id }, body: { reason } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
