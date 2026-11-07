// @vitest-environment jsdom
/**
 * The "tell me when someone opens a link I shared" switch: Internet Identity
 * is asked first, the backend records the choice only after a yes, and the
 * switch hides where it cannot work.
 */
import { createTestClient } from "@ic-reactor/core/testing"
import { ReactorProvider } from "@ic-reactor/react"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { actor, type Account, type Actor } from "../src/canisters/backend"

const BACKEND = "bkyz2-fmaaa-aaaaa-qaaaq-cai"

/** Internet Identity's side: the next answer, and how often it was asked. */
const ii = vi.hoisted(() => ({
  answer: true as boolean | "unsupported",
  asked: 0,
  consent: false,
  kind: "ii" as "ii" | "guest",
}))

vi.mock("../src/app/session", () => ({
  useSession: () => ({ status: "signed-in", signedIn: true, principal: "alice", kind: ii.kind }),
}))

vi.mock("../src/reactor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/reactor")>()
  return {
    ...actual,
    sessionAuth: () => ({
      async requestNotificationConsent() {
        ii.asked += 1
        if (ii.answer === "unsupported") {
          const { NotificationsUnsupportedError } = await import("@icp-sdk/auth/client")
          throw new NotificationsUnsupportedError()
        }
        ii.consent = ii.answer
        return ii.answer
      },
      async notificationConsent() {
        return ii.consent
      },
    }),
  }
})

const placeholderRootKey = "00".repeat(133)
document.cookie = `ic_env=${encodeURIComponent(
  `ic_root_key=${placeholderRootKey}&PUBLIC_CANISTER_ID:backend=${BACKEND}`,
)}`

const backend = { available: true, wanted: false, calls: [] as boolean[] }

const { client, mock } = createTestClient({ identity: Ed25519KeyIdentity.generate(), allowEnvConfig: true })
mock<Actor>(actor, BACKEND, {
  get_account: ({ caller }) => ({
    tag: "Ok",
    value: {
      principal: caller,
      created_at: 0n,
      note_count: 0,
      storage_bytes: 0n,
      share_count: 0,
      limits: {
        max_notes_per_user: 1,
        max_note_bytes: 1,
        max_shares_per_user: 1,
        max_share_views: 1,
        max_share_ttl_secs: 1n,
        key_requests_per_user_per_hour: 1,
        global_key_requests_per_hour: 1,
        ai_requests_per_user_per_hour: 1,
        global_ai_requests_per_hour: 1,
        max_ai_input_bytes: 1,
      },
      ai_enabled: false,
      ai_model: "",
      notifications_available: backend.available,
      notify_share_opened: backend.wanted,
    } satisfies Account,
  }),
  set_notify_share_opened: (enabled) => {
    backend.calls.push(enabled)
    backend.wanted = enabled
    return { tag: "Ok" }
  },
})

const { useShareOpenedNotifications } = await import("../src/app/notifications")

function wrapper({ children }: { children: ReactNode }) {
  return <ReactorProvider client={() => client}>{children}</ReactorProvider>
}

async function render() {
  const hook = renderHook(() => useShareOpenedNotifications(), { wrapper })
  await waitFor(() =>
    expect(hook.result.current.available || !backend.available || ii.kind !== "ii").toBe(true),
  )
  return hook
}

beforeEach(() => {
  Object.assign(ii, { answer: true, asked: 0, consent: false, kind: "ii" })
  Object.assign(backend, { available: true, wanted: false, calls: [] })
})
afterEach(() => {
  cleanup()
  client.queryClient.clear()
})
afterAll(() => client.dispose())

describe("useShareOpenedNotifications", () => {
  it("asks Internet Identity first and records the choice only after a yes", async () => {
    const { result } = await render()
    expect(result.current.on).toBe(false)

    ii.answer = false
    expect(await act(() => result.current.turnOn())).toBe("refused")
    expect(backend.calls).toEqual([])

    ii.answer = true
    expect(await act(() => result.current.turnOn())).toBe("on")
    expect(backend.calls).toEqual([true])
    await waitFor(() => expect(result.current.on).toBe(true))
    expect(ii.asked).toBe(2)
  })

  it("turns off in B3Note without asking Internet Identity", async () => {
    backend.wanted = true
    ii.consent = true
    const { result } = await render()
    await waitFor(() => expect(result.current.on).toBe(true))
    await act(() => result.current.turnOff())
    expect(backend.calls).toEqual([false])
    await waitFor(() => expect(result.current.on).toBe(false))
    expect(ii.asked).toBe(0)
  })

  it("says so when it is on here but Internet Identity's consent is gone", async () => {
    backend.wanted = true
    ii.consent = false
    const { result } = await render()
    await waitFor(() => expect(result.current.consentMissing).toBe(true))
  })

  it("is not offered to guests or on a deployment that sends none", async () => {
    ii.kind = "guest"
    expect((await render()).result.current.available).toBe(false)
    cleanup()
    ii.kind = "ii"
    backend.available = false
    const { result } = renderHook(() => useShareOpenedNotifications(), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.available).toBe(false)
  })

  it("hides itself for good where Internet Identity sends no notifications", async () => {
    const { result } = await render()
    ii.answer = "unsupported"
    expect(await act(() => result.current.turnOn())).toBe("unsupported")
    expect(result.current.available).toBe(false)
    expect(backend.calls).toEqual([])
  })
})
