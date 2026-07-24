'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import {
  findAddresses,
  retrieveAddress,
  type AddressSuggestion,
  type RetrievedAddress,
} from '@/lib/addresscomplete';
import { Input } from '@/components/ui/input';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

// Line-1 input with Canada Post AddressComplete suggestions. Degrades to a
// plain input when lookups return nothing (no key, offline, no matches).
export function AddressAutocomplete({
  id,
  registration,
  onSelect,
  ariaInvalid,
  placeholder,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  onSelect: (address: RetrievedAddress) => void;
  ariaInvalid?: boolean;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const termRef = useRef('');
  // Increments per lookup so stale responses can't overwrite newer ones.
  const requestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  function show(items: AddressSuggestion[]) {
    setSuggestions(items);
    setActiveIndex(-1);
    setOpen(items.length > 0);
  }

  async function lookup(term: string, lastId?: string) {
    const request = ++requestRef.current;
    const items = await findAddresses(term, lastId);
    if (request === requestRef.current) show(items);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const term = e.target.value;
    termRef.current = term;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.trim().length < MIN_CHARS) {
      requestRef.current++;
      show([]);
      return;
    }
    debounceRef.current = setTimeout(() => void lookup(term), DEBOUNCE_MS);
  }

  async function choose(suggestion: AddressSuggestion) {
    if (suggestion.next === 'Find') {
      await lookup(termRef.current, suggestion.id);
      return;
    }
    setOpen(false);
    const address = await retrieveAddress(suggestion.id);
    if (address) onSelect(address);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        void choose(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      // Discard any debounce that's still armed and any in-flight lookup,
      // so a Find triggered before the Escape can't reopen the dropdown.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      requestRef.current++;
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        autoComplete="off"
        {...registration}
        onChange={(e) => {
          void registration.onChange(e);
          handleChange(e);
        }}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          void registration.onBlur(e);
          // Delay so a click on a suggestion lands before the list closes.
          blurTimeoutRef.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex ? 'bg-accent text-accent-foreground' : ''
              }`}
              // mousedown fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(suggestion);
              }}
            >
              <span>{suggestion.text}</span>
              {suggestion.description && (
                <span className="ml-2 text-muted-foreground">
                  {suggestion.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
