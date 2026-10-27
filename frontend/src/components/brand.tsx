import { Link } from "@tanstack/react-router"
import { FOLD, LOCKUP_VIEWBOX, SHEET, THREE, WORD, WORD_X } from "./logoPaths"

const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ")

/** The folded sheet on its own: the node of the B3Note mark, in accent. */
export function SheetMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="18.4 38.65 14.7 14.7"
      width={size}
      height={size}
      aria-hidden
      className={cn("bn-sheet-mark shrink-0", className)}
    >
      <path d={SHEET} />
      <path d={FOLD} />
    </svg>
  )
}

/** The mark's parts on B3Pay's 96-unit grid: blocks and 3 in ink, the sheet in accent. */
function MarkParts({ sheetClass }: { sheetClass?: string }) {
  return (
    <>
      <rect className="bn-loader-ink" x="18.75" y="11" width="14" height="24" rx="3" />
      <g className={cn("bn-sheet-mark", sheetClass)}>
        <path d={SHEET} />
        <path d={FOLD} />
      </g>
      <rect className="bn-loader-ink" x="18.75" y="57" width="14" height="28" rx="3" />
      <path className="bn-loader-ink" d={THREE} />
    </>
  )
}

/** The B3Note lockup, drawn inline so it follows the theme. Draft mark, see the design system. */
export function Logo({ className = "inline-flex", compact }: { className?: string; compact?: boolean }) {
  // The caller sets the display (`inline-flex`, `hidden sm:inline-flex`), so the two never fight.
  return (
    <Link to="/" aria-label="B3Note home" className={cn("items-center rounded", className)}>
      {compact ? (
        <svg viewBox="0 0 96 96" className="h-8 w-8" role="img" aria-label="B3Note">
          <MarkParts />
        </svg>
      ) : (
        <svg viewBox={LOCKUP_VIEWBOX} className="h-7 w-auto" role="img" aria-label="B3Note">
          <g transform="translate(0 -886.667) scale(11.667)">
            <MarkParts />
          </g>
          <path className="bn-loader-ink" transform={`translate(${WORD_X} 0)`} d={WORD} />
        </svg>
      )}
    </Link>
  )
}

/** The B3Note mark, animated: the folded sheet breathes while something works. */
export function Loader({
  size = 48,
  label = "Working",
  showLabel,
  className,
}: {
  size?: number
  label?: string
  showLabel?: boolean
  className?: string
}) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 96 96"
        width={size}
        height={size}
        aria-hidden
        className="overflow-visible text-zinc-900 dark:text-zinc-100"
      >
        <MarkParts sheetClass="bnl-sheet" />
      </svg>
      {showLabel ? (
        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  )
}

/** Blank paper, stacked: the picture for an empty board. */
export function PaperStack() {
  return (
    <div className="bn-stack" aria-hidden>
      <span className="bn-folded" data-paper="peach" />
      <span className="bn-folded" data-paper="sky" />
      <span className="bn-folded" data-paper="butter">
        <i style={{ top: 26, width: 40 }} />
        <i style={{ top: 38, width: 48 }} />
        <i style={{ top: 50, width: 30 }} />
      </span>
    </div>
  )
}

export type Paper = "butter" | "peach" | "mint" | "sky" | "lilac"
const PAPERS: Paper[] = ["butter", "peach", "mint", "sky", "lilac"]
const TILTS = ["-0.6deg", "0.5deg", "-0.3deg", "0.7deg", "-0.45deg"]

/** A note keeps its paper and resting tilt: both come from its id. */
export function paperFor(id: string): { paper: Paper; tilt: string } {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return { paper: PAPERS[hash % PAPERS.length], tilt: TILTS[(hash >>> 3) % TILTS.length] }
}
