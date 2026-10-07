import { Sparkles } from "lucide-react"
import { setAiConsent } from "../lib/ai"
import { Dialog } from "./Dialog"
import { Button } from "./ui"

/** Asked once before the first AI request. */
export function AiConsentDialog({
  open,
  onClose,
  onAccept,
  model,
}: {
  open: boolean
  onClose: () => void
  onAccept: () => void
  model?: string
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Before you use the AI assistant">
      <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          Your notes are end-to-end encrypted, so the canister cannot read them. To help you, the assistant
          needs the text itself: when you run an AI action, the text you chose is sent to the Internet
          Computer's LLM canister{model ? ` (${model})` : ""} and processed by its AI workers.
        </p>
        <p>The text is not stored by B3Note, and nothing is sent until you pick an action.</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            setAiConsent(true)
            onAccept()
          }}
        >
          <Sparkles className="h-4 w-4" /> I understand, continue
        </Button>
      </div>
    </Dialog>
  )
}
