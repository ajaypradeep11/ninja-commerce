"use client"

import { useSyncExternalStore } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { THEMES, resolveTheme } from "@/theme/registry"

// Sonner has no notion of our theme registry, so we derive light/dark from
// the live data-theme attribute rather than next-themes (which this project
// doesn't otherwise use). A MutationObserver keeps it in sync with runtime
// theme switches (see ThemeSwitcher).
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  })
  return () => observer.disconnect()
}

function getSnapshot(): boolean {
  const id = resolveTheme(document.documentElement.getAttribute("data-theme"))
  return THEMES.find((t) => t.id === id)?.dark ?? false
}

// SSR/before-mount: default to light, matching the default theme (everloom).
function getServerSnapshot(): boolean {
  return false
}

const Toaster = ({ ...props }: ToasterProps) => {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <Sonner
      theme={dark ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
