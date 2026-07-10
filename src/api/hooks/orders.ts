import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ordersControllerFindAll,
  ordersControllerFindOne,
  ordersControllerRefund,
  ordersControllerUpdateStatus,
} from '../generated/sdk.gen';
import type { OrderStatus } from '@/lib/order-actions';
import { unwrap } from '../unwrap';

export interface OrderListParams {
  status?: OrderStatus;
  email?: string;
  page: number;
}

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () =>
      unwrap(
        ordersControllerFindAll({
          query: {
            page: params.page,
            pageSize: 20,
            ...(params.status ? { status: params.status } : {}),
            ...(params.email ? { email: params.email } : {}),
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string, refetchIntervalMs?: number) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => unwrap(ordersControllerFindOne({ path: { id } })),
    refetchInterval: refetchIntervalMs ?? false,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'SHIPPED' | 'DELIVERED';
    }) => unwrap(ordersControllerUpdateStatus({ path: { id }, body: { status } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(ordersControllerRefund({ path: { id } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
