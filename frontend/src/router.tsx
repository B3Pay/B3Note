import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router"
import { FileQuestion } from "lucide-react"
import { Toaster } from "sonner"
import { useTheme } from "./app/theme"
import { AppHeader } from "./components/AppHeader"
import { EmptyState } from "./components/ui"
import { LandingPage } from "./routes/Landing"

function Root() {
  const theme = useTheme()
  return (
    <div className="min-h-full">
      <AppHeader />
      <Outlet />
      <Toaster richColors position="bottom-right" theme={theme} />
    </div>
  )
}

function NotFound() {
  return (
    <EmptyState icon={<FileQuestion className="h-10 w-10" />} title="Page not found">
      The page you are looking for does not exist.
    </EmptyState>
  )
}

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: LandingPage })

const shareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/s/$shareId",
  component: lazyRouteComponent(() => import("./routes/SharedNote"), "SharedNotePage"),
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: lazyRouteComponent(() => import("./routes/SignedInLayout"), "SignedInLayout"),
})

const notesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes",
  component: lazyRouteComponent(() => import("./routes/Notes"), "NotesLayout"),
})

const notesIndexRoute = createRoute({
  getParentRoute: () => notesRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./routes/Notes"), "NotesIndex"),
})

const noteRoute = createRoute({
  getParentRoute: () => notesRoute,
  path: "$noteId",
  component: lazyRouteComponent(() => import("./routes/NoteEditor"), "NoteEditorRoute"),
  validateSearch: (search: Record<string, unknown>): { draft?: boolean } =>
    search.draft === true || search.draft === "true" ? { draft: true } : {},
})

const askRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ask",
  component: lazyRouteComponent(() => import("./routes/Ask"), "AskPage"),
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./routes/Settings"), "SettingsPage"),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  shareRoute,
  appRoute.addChildren([notesRoute.addChildren([notesIndexRoute, noteRoute]), askRoute, settingsRoute]),
])

export const router = createRouter({ routeTree, defaultPreload: "intent" })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
