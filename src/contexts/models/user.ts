import { createModel } from "@rematch/core"
import { UserNote } from "declarations/backend/backend.did"
import type { RootModel } from "../store"

interface UserState {
  notes: UserNote[]
  prices: {
    [key: string]: string
  }
  allowance: {
    [key: string]: string
  }
  account: string
  network: string
  chainId: number
  message: string
  blockNumber: number
  pending: boolean
  transactionHash: string
  transactionSent: boolean
  transactionConfirmed: boolean
  transactionReceipt: any
  transactionFailed: boolean
  disconnect: boolean
  error: string
}

const defaultStates: UserState = {
  notes: [],
  prices: {},
  allowance: {},
  account: "",
  network: "",
  chainId: 0,
  message: "",
  blockNumber: 0,
  pending: false,
  transactionHash: "",
  transactionSent: false,
  transactionConfirmed: false,
  transactionReceipt: {},
  transactionFailed: false,
  disconnect: false,
  error: "",
}

const user = createModel<RootModel>()({
  name: "user",
  state: defaultStates,
  reducers: {
    SET_NOTES: (state, notes: UserNote[]) => ({
      ...state,
      notes,
    }),
  },
  effects: (dispatch) => ({}),
})

export default user
