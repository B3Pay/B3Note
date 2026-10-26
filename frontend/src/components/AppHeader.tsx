import { Link, useNavigate } from "@tanstack/react-router"
import { LogOut, Monitor, Moon, NotebookPen, Settings, Sun } from "lucide-react"
import { useState } from "react"
import { useAnyAi } from "../app/features"
import { signOut, useSession } from "../app/session"
import { setTheme, useTheme, type Theme } from "../app/theme"
import { shortPrincipal } from "../lib/format"
import { Logo, SheetMark } from "./brand"
import { Button } from "./ui"

const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" }

export function ThemeToggle() {
  const theme = useTheme()
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(NEXT_THEME[theme])}
      aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

// B3Pay's nav: muted until current, then ink with a brand underline.
const navLink =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-zinc-600 hover:bg-brand-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-brand-900 dark:hover:text-zinc-100"
const activeNavLink = "rounded-b-none text-zinc-900 shadow-[inset_0_-2px_0_var(--brand)] dark:text-zinc-100"

export function AppHeader() {
  const { signedIn, principal, kind } = useSession()
  const { any: aiEnabled } = useAnyAi()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-4">
        <Logo className="mr-2 hidden sm:inline-flex" />
        <Logo className="mr-1 inline-flex sm:hidden" compact />
        {signedIn ? (
          <nav className="flex items-center gap-1">
            <Link
              to="/notes"
              className={navLink}
              activeProps={{ className: activeNavLink }}
              aria-label="Notes"
            >
              <NotebookPen className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
            </Link>
            {aiEnabled ? (
              <Link
                to="/ask"
                className={navLink}
                activeProps={{ className: activeNavLink }}
                aria-label="Ask your notes"
              >
                <SheetMark size={14} />
                <span className="hidden sm:inline">Ask</span>
              </Link>
            ) : null}
            <Link
              to="/settings"
              className={navLink}
              activeProps={{ className: activeNavLink }}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {signedIn ? (
            <>
              <span
                className="hidden rounded border border-zinc-200 bg-white px-2 py-0.5 font-mono text-xs text-zinc-700 md:inline dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                title={principal}
              >
                {kind === "guest" ? "Guest · " : ""}
                {shortPrincipal(principal)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                loading={busy}
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  setBusy(true)
                  try {
                    await signOut()
                    await navigate({ to: "/" })
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? null : <LogOut className="h-4 w-4" />}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
