export const BACKEND_CANISTER_ID =
  process.env.BACKEND_CANISTER_ID ?? "bkyz2-fmaaa-aaaaa-qaaaq-cai"

export const IDENTITY_CANISTER_ID =
  process.env.INTERNET_IDENTITY_CANISTER_ID ?? "br5f7-7uaaa-aaaaa-qaaca-cai"

export const IS_LOCAL = process.env.DFX_NETWORK !== "ic"
