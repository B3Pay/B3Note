import { ReactorProvider } from "@ic-reactor/react"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { applyTheme } from "./app/theme"
import { client } from "./reactor"
import { router } from "./router"
import "./styles.css"

applyTheme()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Borrows this tab's client: the provider does not dispose it. */}
    <ReactorProvider client={() => client}>
      <RouterProvider router={router} />
    </ReactorProvider>
  </StrictMode>,
)
