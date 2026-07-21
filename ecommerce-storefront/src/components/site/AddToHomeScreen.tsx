'use client';

import { Share, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'storefront.a2hs.dismissed.v1';
// Long enough that it never interrupts a first impression.
const DELAY_MS = 20_000;

/**
 * iOS-only "Add to Home Screen" hint. Safari has no install prompt, so the
 * site has to point at the Share menu itself. Deliberately restrained: it
 * waits, appears once, and a dismissal is remembered forever.
 */
export function AddToHomeScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    // Chrome/Firefox on iOS can't install to the home screen at all.
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS exposes its own flag rather than the standard media query.
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isIos || !isSafari || installed) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      /* private mode — just show it this once */
    }

    const timer = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* nothing to remember it with; it'll show again next visit */
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl bg-black/95 p-3 text-white shadow-lg backdrop-blur">
      <Image
        src="/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-lg"
      />
      <p className="flex-1 text-sm leading-snug">
        Add LocalNinja to your home screen — tap{' '}
        <Share aria-label="Share" className="inline size-4 align-text-bottom" />{' '}
        then <span className="font-semibold">Add to Home Screen</span>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 text-white/70 hover:text-white"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}
