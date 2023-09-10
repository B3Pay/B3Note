import { RematchDispatch } from "@rematch/core"
import { getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import { FetchUserNotesArgs } from "contexts/types/backend"

const getterEffect = (dispatch: RematchDispatch<RootModel>) => ({
  fetch_user_notes: async (args: FetchUserNotesArgs) => {
    const { backendActor, userIdentity, transportSecretKey } =
      getBackendStates()

    const [createdAt, notes] = await backendActor.user_notes(
      userIdentity.isAnonymous() ? [transportSecretKey.public_key()] : []
    )
    console.log({ notes })

    dispatch.backend.SET_NOTES(notes)
    dispatch.backend.SET_CREATED_AT(createdAt)
  },
  fetch_timers: async () => {
    const { backendActor } = getBackendStates()

    return await backendActor.timers()
  },
  fetch_logs: async () => {
    const { backendActor } = getBackendStates()

    return (await backendActor.print_log_entries()).reverse()
  },
  fetch_log_page: async (args: { page: number; pageSize?: number }) => {
    const { backendActor } = getBackendStates()

    const logs = await backendActor.print_log_entries_page(
      BigInt(args.page),
      args.pageSize ? [BigInt(args.pageSize)] : []
    )

    return logs
  },
})

export default getterEffect
