import { Loader2 } from "lucide-react"
import { Loader, PaperStack } from "./brand"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"
import { forwardRef } from "react"

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand-soft"
type Size = "sm" | "md" | "lg" | "icon"

// B3Pay's buttons: one primary per screen; danger is an outline that fills on hover.
const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-zinc-950 dark:hover:bg-brand-400",
  secondary:
    "border border-zinc-500 bg-white text-zinc-900 hover:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-100",
  ghost:
    "text-zinc-600 hover:bg-brand-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-brand-900 dark:hover:text-zinc-100",
  danger:
    "border border-red-600 bg-transparent text-red-600 hover:bg-red-600 hover:text-white dark:hover:text-zinc-950",
  "brand-soft":
    "bg-brand-100 text-zinc-900 hover:bg-brand-200 dark:bg-brand-900 dark:text-zinc-100 dark:hover:bg-brand-800",
}

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-sm",
  md: "h-10 gap-2 rounded-lg px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
  icon: "h-9 w-9 rounded-lg",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-zinc-500 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:ring-brand-500",
        className,
      )}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-zinc-500 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:ring-brand-500",
          className,
        )}
        {...rest}
      />
    )
  },
)

export function Select({
  value,
  onChange,
  options,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  "aria-label"?: string
  id?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 rounded-lg border border-zinc-500 bg-white px-3 text-sm dark:bg-zinc-900",
        className,
      )}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/** Waiting: the B3Note mark with its sheet breathing, and what is happening. */
export function Spinner({
  className,
  label,
  size = 20,
}: {
  className?: string
  label?: string
  size?: number
}) {
  return <Loader size={size} label={label ?? "Loading"} showLabel={Boolean(label)} className={className} />
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TagChip({
  tag,
  active,
  onClick,
  onRemove,
  count,
}: {
  tag: string
  active?: boolean
  onClick?: () => void
  onRemove?: () => void
  count?: number
}) {
  // Chips use B3Pay's small radius; a chosen one is the selection, in brand.
  const classes = cn(
    "inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-semibold transition-colors",
    active
      ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-zinc-950"
      : "bg-zinc-100 text-zinc-700 hover:bg-brand-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-brand-900",
  )
  return (
    <span className={classes}>
      {onClick ? (
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1">
          #{tag}
          {count !== undefined ? <span className="opacity-60">{count}</span> : null}
        </button>
      ) : (
        <span>#{tag}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
          className="opacity-60 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </span>
  )
}

export function EmptyState({
  icon,
  paper,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  /** Show a stack of blank paper instead of an icon. */
  paper?: boolean
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      {paper ? (
        <PaperStack />
      ) : icon ? (
        <div className="text-brand-600 dark:text-brand-500">{icon}</div>
      ) : null}
      <h2 className="text-lg font-semibold text-balance">{title}</h2>
      {children ? <div className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">{children}</div> : null}
      {action}
    </div>
  )
}

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success"
  children: ReactNode
  className?: string
}) {
  // Never color alone: danger carries the diamond, a warning the brand outline.
  const tones = {
    info: "border-transparent bg-brand-100 text-zinc-900 dark:bg-brand-900 dark:text-zinc-100",
    warning:
      "border-brand-600 bg-white text-zinc-900 dark:border-brand-500 dark:bg-zinc-900 dark:text-zinc-100",
    danger: "border-red-600 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100",
    success: "border-transparent bg-brand-100 text-zinc-900 dark:bg-brand-900 dark:text-zinc-100",
  }
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {tone === "danger" ? (
        <span
          aria-hidden
          className="mr-2 inline-block h-2 w-2 -translate-y-px rotate-45 rounded-[1px] bg-red-600"
        />
      ) : null}
      {children}
    </div>
  )
}
