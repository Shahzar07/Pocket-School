"use client"

import { useEffect, type CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon, XIcon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const target = event.target
      if (target instanceof HTMLElement && target.closest("[role='dialog'], [data-slot='dialog-content']")) return
      toast.dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        close: <XIcon className="size-5" />,
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: "Close",
        classNames: {
          toast: "cn-toast pr-14",
          closeButton: "!left-auto !right-2 !top-2 !size-11 !min-h-11 !min-w-11 !translate-x-0 !translate-y-0 !border-border !bg-popover !text-foreground focus-visible:!ring-2 focus-visible:!ring-[#1E6A83] focus-visible:!ring-offset-2",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
