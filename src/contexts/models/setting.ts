import { createModel } from "@rematch/core"
import { RootModel } from "../store"
import {
  ColorKeys,
  ConnectModalType,
  DefaultSettingState,
  SnackBarType,
  ThemeMode,
} from "../types/setting"

const defaultState: DefaultSettingState = {
  showSnackBar: false,
  showDetails: false,
  showAddress: true,
  modal: false,
  theme: {
    mode: "system",
    color: "blue",
  },
  connectModal: {
    open: false,
    tab: undefined,
  },
  snackbar: {
    message: "",
  },
  version: process.env.APP_VERSION || "",
}

const setting = createModel<RootModel>()({
  name: "setting",
  state: defaultState,
  reducers: {
    SET_MODAL: (state, modal: boolean) => ({
      ...state,
      modal,
    }),
    SET_CONNECT_MODAL: (state, connectModal: ConnectModalType) => ({
      ...state,
      connectModal,
    }),
    SET_SNACKBAR: (state, snackbar: SnackBarType) => ({
      ...state,
      snackbar,
      showSnackBar: true,
    }),
    SHOW_SNACKBAR: (state, showSnackBar: boolean) => {
      return {
        ...state,
        showSnackBar,
      }
    },
    SET_THEME_COLOR: (state, color: ColorKeys) => {
      localStorage.setItem("themeColor", color)
      return {
        ...state,
        theme: {
          ...state.theme,
          color,
        },
      }
    },
    SET_THEME_MODE: (state, mode: ThemeMode) => {
      localStorage.setItem("themeMode", mode)
      return {
        ...state,
        theme: {
          ...state.theme,
          mode,
        },
      }
    },
    SET_APP_VERSION: (state, version: string) => {
      return {
        ...state,
        version,
      }
    },
    SET_SHOW_ADDRESS: (state) => {
      return {
        ...state,
        showAddress: !state.showAddress,
      }
    },
    SET_SHOW_DETAILS: (state) => {
      return {
        ...state,
        showDetails: !state.showDetails,
      }
    },
  },

  effects: (dispatch) => ({
    async setModal(modal: boolean) {
      dispatch.settings.SET_MODAL(modal)
    },
    async setSnackBar(snackbar: SnackBarType) {
      dispatch.settings.SET_SNACKBAR(snackbar)
    },
    async setShowSnackBar(showSnackBar: boolean) {
      dispatch.settings.SHOW_SNACKBAR(showSnackBar)
    },
    async setShowAddress() {
      dispatch.settings.SHOW_ADDRESS()
    },
    async setShowDetails() {
      dispatch.settings.SHOW_DETAILS()
    },
  }),
})

export default setting
