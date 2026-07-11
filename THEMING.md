# Theming

This storefront is a generic, forkable ecommerce product. Every component
styles itself through five semantic color roles, three font roles, and a
radius token — so a complete rebrand is a CSS block plus a registry entry.
No component changes.

## Quick start

```bash
# Pick a built-in theme as the default:
NEXT_PUBLIC_THEME=ninja

# Hide the footer theme switcher for a real store:
NEXT_PUBLIC_SHOW_THEME_SWITCHER=false
```

Your brand name, tagline, and copy live separately in `src/lib/site.ts` —
set them once, then use any theme.

## Built-in themes

| id | Vibe |
|---|---|
| `everloom` (default) | Warm organic-cotton editorial |
| `noir` | Dark luxury — serif, gold on near-black |
| `meadow` | Organic wellness — moss green, rounded |
| `arcade` | Bold streetwear — electric blue, hot pink, zero radius |
| `atelier` | Gallery minimal — monochrome, hairline rules |
| `ninja` | Dark tech — yellow on black (homage to localninja.ca) |

Visitors can preview all of them live via the footer switcher; the choice
persists in `localStorage` (`storefront.theme.v1`). Resolution order:
localStorage (if valid) → `NEXT_PUBLIC_THEME` (if valid) → `everloom`.
Invalid values fall back silently, so removing a theme can't break the site.

## The five color roles

| Role | Used for |
|---|---|
| `surface` | Page background |
| `ink` | Body text |
| `brand` | Links, CTAs, focus rings |
| `highlight` | Errors, sale flashes, attention |
| `subtle` | Muted panels, borders, badges |

Components use them as Tailwind utilities (`bg-surface`, `text-ink`,
`text-brand`, `bg-subtle`, …). The shadcn ui primitives (dialogs, selects,
buttons) are wired to the same roles via `src/app/globals.css`, so they
re-theme automatically.

## Add your own theme (worked example: how `ninja` was built)

1. **Define the CSS block** in `src/theme/themes.css`:

   ```css
   [data-theme='ninja'] {
     --color-surface: #0a0a0a;
     --color-ink: #f4f3ef;
     --color-brand: #ffd84d;
     --color-highlight: #e8be8e;
     --color-subtle: #2a2a28;
     --radius: 0.375rem;
   }
   ```

2. **Register it** in `src/theme/registry.ts` — add `'ninja'` to `THEME_IDS`
   and an entry to `THEMES` (label + surface/brand/highlight swatches for the
   switcher). TypeScript and the sync test enforce that both stay aligned.

3. **Fonts (optional).** Add your families in `src/theme/fonts.ts` — the
   single font config. Import the loader from `next/font/google`, call it
   with a `--font-<name>` variable (plus explicit `weight` for
   non-variable fonts, and `preload: false` unless your default theme uses
   it), and add it to `THEME_FONTS`. Then map the roles in `themes.css`:

   ```css
   [data-theme='ninja'] {
     --font-display: var(--font-sora);
     --font-sans: var(--font-inter);
   }
   ```

   Skip this and your theme inherits the default typography. Forks that pin
   `NEXT_PUBLIC_THEME` to a non-default theme should flip `preload: true`
   on their theme's families in `src/theme/fonts.ts` (and may remove or
   un-preload the ones they don't use). `npm test` fails if `themes.css`
   references a font `fonts.ts` doesn't load, or a loaded font goes unused.

4. **Signature divider (optional).** Override `.selvedge` for your theme:

   ```css
   [data-theme='ninja'] .selvedge {
     height: 4px;
     background: repeating-linear-gradient(
       90deg,
       var(--color-brand) 0 24px,
       transparent 24px 36px
     );
   }
   ```

5. **Check contrast.** Run `npm test` — `src/theme/theme-css.test.ts`
   computes WCAG AA ratios for every theme and fails if `ink`/`brand`/
   `highlight` don't reach 4.5:1 on `surface` (or `ink` on `subtle`).
   Dark themes: also eyeball product-image cards and focus rings.

That's it — the switcher, persistence, and SSR default pick up the new
theme from the registry automatically.

## Removing themes for production

Delete the CSS block, the registry entry, and (if unused elsewhere) the
font loads. Set `NEXT_PUBLIC_THEME` to your theme and
`NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`.

`src/components/site/ThemeSwitcher.test.tsx` and `e2e/theming.spec.ts`
reference specific themes (Everloom and Ninja) and assert the default
theme — update both when removing themes or changing the default.

Note that hiding the switcher (`NEXT_PUBLIC_SHOW_THEME_SWITCHER=false`)
does not clear a returning visitor's already-stored theme choice
(`storefront.theme.v1` in `localStorage`); it only stops new choices from
being made.
