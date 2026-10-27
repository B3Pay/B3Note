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
  vi.clearAllMocks()
})

const SHA1 = "[0-9a-f]{40}"
const SRI = /^sha256-[A-Za-z0-9+/]{43}=$/

/** Gives the page a WebGPU adapter with these features. */
function gpuWith(...features: string[]) {
  const requestAdapter = vi.fn(async (_options?: unknown) => ({ features: new Set(features) }))
  vi.stubGlobal("navigator", { gpu: { requestAdapter } })
  return requestAdapter
}

/** The module afresh, since it remembers what it detected. */
function freshLocalAi() {
  vi.resetModules()
  return import("./localAi")
}

describe("the open model", () => {
  it("is web-llm's own record for it, pinned to commits, checked against hashes and needing 16-bit floats", async () => {
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
    expect(rest).toEqual({ ...upstreamRest, required_features: ["shader-f16"] })
    expect(integrity?.config).toMatch(SRI)
    expect(integrity?.model_lib).toMatch(SRI)
    expect(integrity?.tokenizer?.["tokenizer.json"]).toMatch(SRI)
    expect(integrity?.onFailure).toBe("error")
  })

  it("is downloaded and removed through the pinned record", async () => {
    gpuWith("shader-f16")
    const { WEBLLM_CONFIG, WEBLLM_MODEL, forgetLocalModel, prepareLocalAi } = await freshLocalAi()

    await prepareLocalAi()
    expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
      WEBLLM_MODEL,
      expect.objectContaining({ appConfig: WEBLLM_CONFIG }),
    )
    await forgetLocalModel()
    expect(webllm.deleteModelAllInfoInCache).toHaveBeenCalledWith(WEBLLM_MODEL, WEBLLM_CONFIG)
  })
})

describe("the on-device check", () => {
  it("offers the open model on a GPU with 16-bit floats, checking the GPU web-llm would use", async () => {
    const requestAdapter = gpuWith("shader-f16")
    const { detectLocalAi, localAiStatus } = await freshLocalAi()
    await detectLocalAi()
    expect(localAiStatus()).toMatchObject({ status: "download", engine: "webllm" })
    expect(requestAdapter).toHaveBeenCalledWith({ powerPreference: "high-performance" })
  })

  // Without them, web-llm 0.2.85 downloads the whole model and then fails to build its shaders.
  it("does not offer it on a GPU without them", async () => {
    gpuWith()
    const { NO_F16_REASON, detectLocalAi, localAiStatus } = await freshLocalAi()
    await detectLocalAi()
    expect(localAiStatus()).toEqual({ status: "unavailable", reason: NO_F16_REASON })
  })

  it("says why if asked to run anyway", async () => {
    gpuWith()
    const { NO_F16_REASON, localAiError, prepareLocalAi } = await freshLocalAi()
    const error = await prepareLocalAi().catch((e: unknown) => e)
    expect(webllm.CreateMLCEngine).not.toHaveBeenCalled()
    expect(localAiError(error)).toBe(NO_F16_REASON)
  })

  it("explains web-llm's error for a GPU without them", async () => {
    const { NO_F16_REASON, localAiError } = await import("./localAi")
    const error = new Error(
      "This model requires WebGPU extension shader-f16, which is not enabled in this browser.",
    )
    error.name = "ShaderF16SupportError"
    expect(localAiError(error)).toBe(NO_F16_REASON)
  })
})
