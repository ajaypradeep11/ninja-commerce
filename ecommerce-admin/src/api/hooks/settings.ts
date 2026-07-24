import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  settingsControllerGetShipping,
  settingsControllerUpdateShipping,
} from '../generated/sdk.gen';
import type { UpdateShippingSettingsDto } from '../generated/types.gen';
import { unwrap } from '../unwrap';

export function useShippingSettings() {
  return useQuery({
    queryKey: ['settings', 'shipping'],
    queryFn: () => unwrap(settingsControllerGetShipping()),
  });
}

export function useUpdateShippingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateShippingSettingsDto) =>
      unwrap(settingsControllerUpdateShipping({ body })),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['settings', 'shipping'] }),
  });
}
