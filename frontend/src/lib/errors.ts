import { isReactorError } from "@ic-reactor/core"
import type { Error as BackendError } from "../canisters/backend"

/** Turns the canister's `Error` variant into a sentence. */
export function describeBackendError(err: BackendError): string {
  switch (err.tag) {
    case "Unauthenticated":
      return "Please sign in first."
    case "Forbidden":
      return `Not allowed: ${err.value}`
    case "NotFound":
      return "Not found. It may have been deleted, expired or already read."
    case "AlreadyExists":
      return "It already exists."
    case "InvalidArgument":
    case "QuotaExceeded":
      return err.value
    case "RateLimited": {
      const minutes = Math.ceil(Number(err.value.retry_after_secs) / 60)
      return `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    }
    case "Conflict":
      return "This note was changed elsewhere. Reload it before saving again."
    case "Expired":
      return "This link has expired."
    case "Exhausted":
      return "This link has already been used up."
    case "NotReady":
      return "The canister is still setting up its keys. Try again in a moment."
    case "VetKd":
      return `Key derivation failed: ${err.value}`
    case "AiDisabled":
      return "The AI assistant is turned off on this deployment."
    case "Ai":
      return `The AI assistant failed: ${err.value}`
  }
}

/** The tag of the canister's `Err`, when that is what `error` is. */
export function backendErrorTag(error: unknown): BackendError["tag"] | undefined {
  return isReactorError(error) && error.kind === "canister_err" ? (error.err as BackendError).tag : undefined
}

/** A message for any error a call can produce. */
export function errorMessage(error: unknown): string {
  if (isReactorError(error)) {
    switch (error.kind) {
      case "canister_err":
        return describeBackendError(error.err as BackendError)
      case "unauthenticated":
        return "Please sign in first."
      case "not_delivered":
        return "The Internet Computer did not accept the request. Try again."
      case "outcome_unknown":
        return "No answer arrived, so it may or may not have gone through. Check before trying again."
      case "cancelled":
        return "Cancelled because the signed-in account changed."
      case "invalid_reply":
        return "The canister sent a reply this app does not understand."
      default:
        return error.message
    }
  }
  if (error instanceof Error) return error.message
  return String(error)
}
