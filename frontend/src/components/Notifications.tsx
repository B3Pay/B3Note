import { Bell, BellOff } from "lucide-react"
import { toast } from "sonner"
import { useShareOpenedNotifications, type TurnOnResult } from "../app/notifications"
import { errorMessage } from "../lib/errors"
import { Button, Notice } from "./ui"

const REFUSED = "Internet Identity was not allowed to notify you, so nothing changed."
const UNSUPPORTED = "This Internet Identity does not send notifications."

function report(result: TurnOnResult) {
  if (result === "on") toast.success("You will be told when someone opens a link you shared")
  else if (result === "refused") toast.message(REFUSED)
  else toast.message(UNSUPPORTED)
}

/**
 * The switch in Settings, from the caller's `useShareOpenedNotifications()`,
 * which also says whether to show it at all (`available`).
 */
export function ShareOpenedSetting({
  notifications,
}: {
  notifications: ReturnType<typeof useShareOpenedNotifications>
}) {
  const toggle = async (wanted: boolean) => {
    try {
      if (wanted) report(await notifications.turnOn())
      else await notifications.turnOff()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Internet Identity shows them on the devices where you allow it, even with B3Note closed. They say how
        many views a link has left and never which note it was.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={notifications.on}
          disabled={notifications.busy}
          onChange={(e) => void toggle(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        Tell me when someone opens a link I shared
      </label>
      {notifications.consentMissing ? (
        <Notice tone="warning" className="mt-3">
          Internet Identity is not allowed to notify you, so these will not arrive.{" "}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void notifications.turnOn().then(report, (e) => toast.error(errorMessage(e)))}
          >
            <Bell className="h-3.5 w-3.5" /> Allow again
          </Button>
        </Notice>
      ) : null}
      <p className="mt-3 text-xs text-zinc-500">
        Turning this off stops only these. Internet Identity keeps your permission for B3Pay's other notices
        to this account.
      </p>
    </div>
  )
}

/** The offer under a new link, for someone who has not turned it on yet. */
export function ShareOpenedOffer() {
  const notifications = useShareOpenedNotifications()
  if (!notifications.available || notifications.on) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      <BellOff className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
      <span className="min-w-0 flex-1">Want to know when someone opens it?</span>
      <Button
        size="sm"
        variant="brand-soft"
        loading={notifications.busy}
        onClick={() => void notifications.turnOn().then(report, (e) => toast.error(errorMessage(e)))}
      >
        <Bell className="h-3.5 w-3.5" /> Notify me
      </Button>
    </div>
  )
}
