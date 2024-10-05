import { Principal } from "@dfinity/principal"
import { createModel } from "@rematch/core"
import { RootModel } from "contexts/store"
import type { BackendState, DisableArgs } from "contexts/types/backend"
import gcmEffect from "./gcmEffect"
import getterEffect from "./getterEffect"
import ibeEffect from "./ibeEffect"
import initEffect from "./initEffect"
import oneTimeEffect from "./oneTimeEffect"

const state: BackendState = {
  backendActor: null,
  userIdentity: Principal.anonymous(),
  canisterId: null,
  oneTimeKey: null,
  authClient: null,
  transportSecretKey: null,
  ibeDeserialize: null,
  ibeEncrypt: null,
  rawKey: null,
  notes: [],
  encryptedKey: null,
  verificationKey: null,
  verify_offline: null,
  encrypted_decryption_key: null,
  decryptedNotes: {},
  ibeEncryptionKey: null,
  initialized: false,
  loggedIn: false,
  randomSeed: null,
  createdAt: null,
  authCode: {
    code: "",
    signature: "",
  },
  errors: {
    globalError: null,
    decryptionError: {},
  },
}

const backend = createModel<RootModel>()({
  name: "backend",
  state,
  reducers: {
    INIT: (currentState, newState: Partial<BackendState>) => ({
      ...currentState,
      ...newState,
      initialized: true,
    }),
    LOGIN: (currentState, newState: Partial<BackendState>) => ({
      ...currentState,
      ...newState,
      loggedIn: true,
    }),
    UNSET: () => ({ ...state, backend: null, initialized: false }),
    SET_NOTES: (currentState, notes) => ({ ...currentState, notes }),
    SET_CREATED_AT: (currentState, createdAt) => ({
      ...currentState,
      createdAt,
    }),
    SET_SECRET_KEY: (currentState, transportSecretKey) => ({
      ...currentState,
      transportSecretKey,
    }),
    SET_ERROR: (currentState, error) => ({
      ...currentState,
      errors: {
        ...currentState.errors,
        ...error,
      },
    }),
    SET_KEYS: (currentState, newState: Partial<BackendState>) => ({
      ...currentState,
      ...newState,
    }),
    SET_LOGS: (currentState, logs) => ({ ...currentState, logs }),
    ADD_DECRYPTED_NOTE: (currentState, decryptedNote) => ({
      ...currentState,
      decryptedNotes: { ...currentState.decryptedNotes, ...decryptedNote },
    }),
  },
  effects: (dispatch) => ({
    ...initEffect(dispatch),
    ...ibeEffect(dispatch),
    ...gcmEffect(dispatch),
    ...oneTimeEffect(dispatch),
    ...getterEffect(dispatch),
    disable: async (args: DisableArgs) => {
      dispatch.backend.UNSET()
    },
  }),
})

export default backend
