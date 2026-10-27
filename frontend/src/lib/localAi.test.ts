import type { AppConfig, ModelRecord } from "@mlc-ai/web-llm"
import { afterEach, describe, expect, it, vi } from "vitest"

// Stands in for WebLLM, which needs WebGPU.
const webllm = vi.hoisted(() => ({
  CreateMLCEngine: vi.fn(async (..._args: unknown[]) => ({ interruptGenerate() {} })),
  deleteModelAllInfoInCache: vi.fn(async (..._args: unknown[]) => {}),
}))
vi.mock("@mlc-ai/web-llm", () => webllm)

afterEach(() => {
  vi.unstubAllGlobals()
})

const SHA1 = "[0-9a-f]{40}"
const SRI = /^sha256-[A-Za-z0-9+/]{43}=$/

describe("the open model", () => {
  it("is web-llm's own record for it, pinned to commits and checked against hashes", async () => {
    const { WEBLLM_CONFIG, WEBLLM_MODEL } = await import("./localAi")
    const { prebuiltAppConfig } = await vi.importActual<{ prebuiltAppConfig: AppConfig }>("@mlc-ai/web-llm")
    const upstream = prebuiltAppConfig.model_list.find((m) => m.model_id === WEBLLM_MODEL) as ModelRecord
    const [pinned] = WEBLLM_CONFIG.model_list
    const { model, model_lib, integrity, ...rest } = pinned
    const { model: upstreamModel, model_lib: upstreamLib, ...upstreamRest } = upstream

    expect(model).toMatch(new RegExp(`/resolve/${SHA1}/$`))
    expect(model.replace(new RegExp(`resolve/${SHA1}/$`), "")).toBe(`${upstreamModel}/`)
    expect(model_lib).toMatch(
      new RegExp(`^https://raw\\.githubusercontent\\.com/mlc-ai/binary-mlc-llm-libs/${SHA1}/`),
    )
    expect(model_lib.replace(new RegExp(`/${SHA1}/`), "/main/")).toBe(upstreamLib)
    expect(rest).toEqual(upstreamRest)
    expect(integrity?.config).toMatch(SRI)
    expect(integrity?.model_lib).toMatch(SRI)
    expect(integrity?.tokenizer?.["tokenizer.json"]).toMatch(SRI)
    expect(integrity?.onFailure).toBe("error")
  })

  it("is downloaded and removed through the pinned record", async () => {
    vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({}) } })
    vi.resetModules()
    const { WEBLLM_CONFIG, WEBLLM_MODEL, forgetLocalModel, prepareLocalAi } = await import("./localAi")

    await prepareLocalAi()
    expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
      WEBLLM_MODEL,
      expect.objectContaining({ appConfig: WEBLLM_CONFIG }),
    )
    await forgetLocalModel()
    expect(webllm.deleteModelAllInfoInCache).toHaveBeenCalledWith(WEBLLM_MODEL, WEBLLM_CONFIG)
  })
})
