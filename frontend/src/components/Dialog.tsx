import { X } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "./ui"

/** A modal built on the native <dialog> element. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const isOpen = useRef(open)
  isOpen.current = open

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      // Closing it from the `open` prop fires `close` too; only a close the
      // parent did not ask for (e.g. a form with method="dialog") reports back.
      onClose={() => {
        if (isOpen.current) onClose()
      }}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        className,
      )}
    >
      {open ? (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description ? (
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
