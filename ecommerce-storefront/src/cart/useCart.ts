'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { cartCount, getLines, getServerLines, subscribe, subtotalCents } from './store';

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getLines, getServerLines);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return { lines, subtotal: subtotalCents(lines), count: cartCount(lines), hydrated };
}
