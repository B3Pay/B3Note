const NANOS_PER_MS = 1_000_000n

export function nanosToDate(nanos: bigint): Date {
  return new Date(Number(nanos / NANOS_PER_MS))
}

export function dateToNanos(date: Date): bigint {
  return BigInt(date.getTime()) * NANOS_PER_MS
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

/** "3 minutes ago", "in 2 hours", ... */
export function relativeTime(date: Date, now = Date.now()): string {
  const seconds = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  // Canister and device clocks differ by a few seconds.
  if (abs < 60) return "just now"
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3_600],
    ["day", 86_400],
    ["week", 604_800],
    ["month", 2_629_800],
    ["year", 31_557_600],
  ]
  let unit: Intl.RelativeTimeFormatUnit = "minute"
  let size = 60
  for (const [name, length] of units) {
    if (abs >= length * 0.9) {
      unit = name
      size = length
    }
  }
  return relative.format(Math.round(seconds / size), unit)
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function formatBytes(bytes: number | bigint): string {
  const value = Number(bytes)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function shortPrincipal(text: string): string {
  return text.length > 20 ? `${text.slice(0, 11)}…${text.slice(-7)}` : text
}

export const DURATION_CHOICES: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 3_600 },
  { label: "1 day", seconds: 86_400 },
  { label: "7 days", seconds: 604_800 },
  { label: "30 days", seconds: 2_592_000 },
]
