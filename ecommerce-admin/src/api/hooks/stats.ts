import { useQuery } from '@tanstack/react-query';
import { adminControllerStats } from '../generated/sdk.gen';
import { unwrap } from '../unwrap';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => unwrap(adminControllerStats()),
    refetchOnWindowFocus: true,
  });
}
