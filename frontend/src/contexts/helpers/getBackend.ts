import store from "contexts/store"

import { BackendStateAfterInitialization } from "contexts/types/backend"
import { setSnackbar } from "./setSetting"

export const getBackendStates = (): BackendStateAfterInitialization => {
  const state = store.getState().backend

  if (!state.initialized) {
    setSnackbar({
      title: "Backend is not initialized",
      message: "Please initialize backend first",
      severity: "error",
    })

    throw new Error("Backend is not initialized")
  }

  return state as BackendStateAfterInitialization
}
