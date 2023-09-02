import store from "../store"

export const setChainId = (chainId: number) =>
  store.dispatch.wallet.SET_CHAIN_ID(chainId)

export const setAccount = (account: string) =>
  store.dispatch.wallet.SET_ACCOUNT(account)

export const disconnect = () => store.dispatch.wallet.SET_ACCOUNT("")
