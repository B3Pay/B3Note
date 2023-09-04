import { init, Models, RematchDispatch, RematchRootState } from "@rematch/core"
import loadingPlugin, { ExtraModelsFromLoading } from "@rematch/loading"

import backend from "./models/backend"
import setting from "./models/setting"
import user from "./models/user"

export type Store = typeof store

type FullModel = ExtraModelsFromLoading<RootModel>

export type Dispatch = RematchDispatch<RootModel>
export type RootState = RematchRootState<RootModel, FullModel>

export interface RootModel extends Models<RootModel> {
  user: typeof user
  setting: typeof setting
  backend: typeof backend
}

export const models: RootModel = {
  user,
  setting,
  backend,
}

const store = init<RootModel, FullModel>({ models, plugins: [loadingPlugin()] })

export default store
