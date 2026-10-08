import { Loader2 } from "lucide-react"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"
import { forwardRef } from "react"

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand-soft"
type Size = "sm" | "md" | "lg" | "icon"

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-600/60 dark:bg-brand-500 dark:hover:bg-brand-400 dark:text-zinc-950",
  secondary:
    "border border-zinc-200 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/60",
  "brand-soft":
    "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/70",
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
        "inline-flex shrink-0 items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
        "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
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
          "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
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
        "h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900",
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

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-zinc-500", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
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
  const classes = cn(
    "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors",
    active
      ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-zinc-950"
      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
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
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      {icon ? <div className="text-brand-500">{icon}</div> : null}
      <h2 className="text-lg font-semibold">{title}</h2>
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
  const tones = {
    info: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-100",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    danger:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  }
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>
}
