/**
 * "Tell me when someone opens a link I shared": the owner's side.
 *
 * Three yeses make a notification: the deployment's (`notifications_available`,
 * a controller's switch), the owner's in B3Note (`notify_share_opened`, which
 * the backend keeps), and the owner's in Internet Identity (consent, which
 * Internet Identity keeps and asks for in its own window). Turning it on asks
 * Internet Identity first and records the choice only if they agreed; turning
 * it off only records the choice, so the consent stays for anything else
 * B3Pay sends this account, and Internet Identity is where it is withdrawn.
 */
import { useClient } from "@ic-reactor/react"
import { NotificationsUnsupportedError } from "@icp-sdk/auth/client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { backendOf, sessionAuth } from "../reactor"
import { useSession } from "./session"

export type TurnOnResult = "on" | "refused" | "unsupported"

/** Set once this page's Internet Identity has said it sends no notifications. */
let unsupported = false

const CONSENT_KEY = ["b3note", "ii-notification-consent"] as const

export function isUnsupported(error: unknown): boolean {
  return (
    error instanceof NotificationsUnsupportedError ||
    (error instanceof Error && error.name === "NotificationsUnsupportedError")
  )
}

export function useShareOpenedNotifications() {
  const { kind, principal } = useSession()
  const client = useClient()
  const backend = backendOf(client)
  const account = useQuery({ ...client.queryOptions(backend, "get_account"), enabled: kind === "ii" })
  const [hidden, setHidden] = useState(unsupported)
  const [busy, setBusy] = useState(false)

  const available = kind === "ii" && !hidden && account.data?.notifications_available === true
  const on = available && account.data?.notify_share_opened === true
  // Painted, never gated on: a query, and an Internet Identity without the
  // method is no reason to hide the switch.
  const consent = useQuery({
    queryKey: [...CONSENT_KEY, principal],
    queryFn: () => sessionAuth().notificationConsent(),
    enabled: on,
    retry: false,
    staleTime: 60_000,
  })

  const refresh = () =>
    Promise.all([
      client.queryClient.invalidateQueries({ queryKey: client.queryKey(backend) }),
      client.queryClient.invalidateQueries({ queryKey: CONSENT_KEY }),
    ])

  /** Call it straight from a click: the first thing it does is open Internet Identity. */
  const turnOn = async (): Promise<TurnOnResult> => {
    const asking = sessionAuth().requestNotificationConsent()
    setBusy(true)
    try {
      let granted: boolean
      try {
        granted = await asking
      } catch (error) {
        if (!isUnsupported(error)) throw error
        unsupported = true
        setHidden(true)
        return "unsupported"
      }
      if (!granted) return "refused"
      await backend.set_notify_share_opened(true)
      await refresh()
      return "on"
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async (): Promise<void> => {
    setBusy(true)
    try {
      await backend.set_notify_share_opened(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return {
    /** Show a control at all: an Internet Identity account on a deployment that notifies. */
    available,
    on,
    /** On in B3Note, but Internet Identity says it may not notify them. */
    consentMissing: on && consent.data === false,
    busy,
    turnOn,
    turnOff,
  }
}
