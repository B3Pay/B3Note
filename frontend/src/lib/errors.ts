import { isCallError, isCanisterError } from "@ic-reactor/react"
import type { Error as BackendError } from "../declarations/backend/declarations/backend"

/** Turns the canister's `Error` variant into a sentence. */
export function describeBackendError(err: BackendError): string {
  if ("Unauthenticated" in err) return "Please sign in first."
  if ("Forbidden" in err) return `Not allowed: ${err.Forbidden}`
  if ("NotFound" in err) return "Not found. It may have been deleted, expired or already read."
  if ("AlreadyExists" in err) return "It already exists."
  if ("InvalidArgument" in err) return err.InvalidArgument
  if ("QuotaExceeded" in err) return err.QuotaExceeded
  if ("RateLimited" in err) {
    const minutes = Math.ceil(Number(err.RateLimited.retry_after_secs) / 60)
    return `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
  }
  if ("Conflict" in err) return "This note was changed elsewhere. Reload it before saving again."
  if ("Expired" in err) return "This link has expired."
  if ("Exhausted" in err) return "This link has already been used up."
  if ("NotReady" in err) return "The canister is still setting up its keys. Try again in a moment."
  if ("VetKd" in err) return `Key derivation failed: ${err.VetKd}`
  if ("AiDisabled" in err) return "The AI assistant is turned off on this deployment."
  if ("Ai" in err) return `The AI assistant failed: ${err.Ai}`
  return "Something went wrong."
}

/** A message for any error a call can produce. */
export function errorMessage(error: unknown): string {
  if (isCanisterError(error)) return describeBackendError(error.err as BackendError)
  if (isCallError(error)) {
    if (/fetch|network|Failed to fetch/i.test(error.message)) {
      return "Could not reach the Internet Computer. Check your connection."
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}

export function errorCode(error: unknown): string | undefined {
  return isCanisterError(error) ? error.code : undefined
}
