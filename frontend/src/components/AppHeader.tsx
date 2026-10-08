import { Link, useNavigate } from "@tanstack/react-router"
import { LogOut, Monitor, Moon, NotebookPen, Settings, Sparkles, Sun } from "lucide-react"
import { useState } from "react"
import { useAiEnabled } from "../app/features"
import { signOut, useSession } from "../app/session"
import { setTheme, useTheme, type Theme } from "../app/theme"
import { shortPrincipal } from "../lib/format"
import { Button, cn } from "./ui"

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

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <img src="/logo.svg" alt="" className="h-7 w-7" />
      <span>
        B3<span className="text-brand-600 dark:text-brand-400">Note</span>
      </span>
    </Link>
  )
}

const navLink =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
const activeNavLink = "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"

export function AppHeader() {
  const { signedIn, principal, kind } = useSession()
  const aiEnabled = useAiEnabled()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-4">
        <Logo className="mr-2" />
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
                aria-label="Ask AI"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Ask AI</span>
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
                className="hidden rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-600 md:inline dark:bg-zinc-800 dark:text-zinc-300"
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
