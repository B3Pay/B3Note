/**
 * On-device AI. Notes are decrypted only in this browser, so this assistant runs
 * here too: Chrome's built-in Gemini Nano when the browser has it, otherwise an
 * open model downloaded once and run on the GPU with WebLLM. No note text is sent
 * anywhere; only the model's files are downloaded, the first time.
 */
import type { AppConfig, MLCEngine } from "@mlc-ai/web-llm"

export type LocalEngine = "chrome" | "webllm"

export type LocalAiStatus =
  | { status: "checking" }
  | { status: "ready"; engine: LocalEngine; model: string }
  | { status: "download"; engine: LocalEngine; model: string; size: string }
  | { status: "downloading"; engine: LocalEngine; model: string; progress: number; text: string }
  | { status: "unavailable"; reason: string }

export interface LocalPrompt {
  system: string
  user: string
  maxTokens: number
  temperature: number
}

export const WEBLLM_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"

/**
 * The open model, pinned. web-llm's own list downloads the model's files and
 * its WebAssembly library from the `main` branches of Hugging Face and GitHub,
 * so whoever can push there could change the code that reads decrypted notes.
 * This record fixes both at a commit, and web-llm checks the config, the
 * tokenizer and the library against these hashes before it runs anything
 * (`onFailure: "error"`). The rest is web-llm 0.2.85's own record for the
 * model (localAi.test.ts compares them); a web-llm upgrade that moves to new
 * model libraries needs a new pin.
 */
export const WEBLLM_CONFIG: AppConfig = {
  model_list: [
    {
      model:
        "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/9bd564b064631febf14deadcac492efb761d60c3/",
      model_id: WEBLLM_MODEL,
      model_lib:
        "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/025bcaf3780fa8254f5e5efd3bfea0a5397248f4/web-llm-models/v0_2_84/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
      low_resource_required: true,
      vram_required_MB: 1629.75,
      overrides: { context_window_size: 4096 },
      integrity: {
        config: "sha256-faSVQhLT8hqRzD5pPRefYyE/1XNWeWhH9l1/lUeKH54=",
        tokenizer: { "tokenizer.json": "sha256-wDghF+oynN8JcEETL21zWSS2l5JNb2/DlFcT6WzodTk=" },
        model_lib: "sha256-D861C7r0fv3DH86WtywRXct/UiHIWr5qn8At2p0db8M=",
        onFailure: "error",
      },
    },
  ],
}

const MODEL_NAME: Record<LocalEngine, string> = { chrome: "gemini-nano", webllm: "Qwen2.5-1.5B-Instruct" }
const DOWNLOAD_SIZE: Record<LocalEngine, string> = {
  chrome: "Chrome downloads it once",
  webllm: "About 1 GB, once",
}
const READY_KEY = "b3note:local-ai"
const LANGUAGE = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
}
export const UNAVAILABLE_REASON =
  "This browser can't run a model on this device. It needs Chrome's built-in AI or WebGPU: try a recent Chrome or Edge on a laptop or desktop."

interface Runner {
  generate(prompt: LocalPrompt, signal: AbortSignal, onText: (text: string) => void): Promise<string>
}

let state: LocalAiStatus = { status: "checking" }
let engine: LocalEngine | null = null
let runner: Runner | null = null
let preparing: Promise<Runner> | null = null
let detecting: Promise<void> | null = null
const listeners = new Set<() => void>()

function set(next: LocalAiStatus) {
  state = next
  for (const listener of listeners) listener()
}

export const localAiStatus = (): LocalAiStatus => state

export function subscribeLocalAi(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The Prompt API: `LanguageModel` today, `ai.languageModel` in older Chrome builds.
function languageModel(): any {
  const scope = globalThis as any
  return scope.LanguageModel ?? scope.ai?.languageModel ?? null
}

function remembered(): boolean {
  try {
    return localStorage.getItem(READY_KEY) === WEBLLM_MODEL
  } catch {
    return false
  }
}

function remember(ready: boolean) {
  try {
    if (ready) localStorage.setItem(READY_KEY, WEBLLM_MODEL)
    else localStorage.removeItem(READY_KEY)
  } catch {
    // Not persisted: the next visit checks again.
  }
}

/** Finds the model this browser can run. Downloads nothing. */
export function detectLocalAi(): Promise<void> {
  if (detecting) return detecting
  detecting = (async () => {
    const lm = languageModel()
    if (lm?.availability) {
      try {
        const availability = await lm.availability(LANGUAGE)
        if (availability === "available" || availability === "readily") {
          engine = "chrome"
          return set({ status: "ready", engine, model: MODEL_NAME.chrome })
        }
        if (availability !== "unavailable" && availability !== "no") {
          engine = "chrome"
          return set({ status: "download", engine, model: MODEL_NAME.chrome, size: DOWNLOAD_SIZE.chrome })
        }
      } catch {
        // Fall through to WebGPU.
      }
    }
    const gpu = (navigator as any).gpu
    const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null
    if (adapter) {
      engine = "webllm"
      return set(
        remembered()
          ? { status: "ready", engine, model: MODEL_NAME.webllm }
          : { status: "download", engine, model: MODEL_NAME.webllm, size: DOWNLOAD_SIZE.webllm },
      )
    }
    set({ status: "unavailable", reason: UNAVAILABLE_REASON })
  })()
  return detecting
}

function chromeRunner(): Runner {
  const lm = languageModel()
  return {
    async generate(prompt, signal, onText) {
      const session = await lm.create({
        ...LANGUAGE,
        initialPrompts: [{ role: "system", content: prompt.system }],
        signal,
      })
      try {
        let full = ""
        for await (const chunk of session.promptStreaming(prompt.user, { signal })) {
          // Older builds stream the whole text so far, newer ones stream the new part.
          full = full && chunk.length > full.length && chunk.startsWith(full) ? chunk : full + chunk
          onText(full)
        }
        return full
      } finally {
        session.destroy?.()
      }
    },
  }
}

function webllmRunner(mlc: MLCEngine): Runner {
  return {
    async generate(prompt, signal, onText) {
      const stop = () => mlc.interruptGenerate()
      signal.addEventListener("abort", stop)
      try {
        const chunks = await mlc.chat.completions.create({
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          stream: true,
          temperature: prompt.temperature,
          max_tokens: prompt.maxTokens,
        })
        let full = ""
        for await (const chunk of chunks) {
          if (signal.aborted) break
          full += chunk.choices[0]?.delta?.content ?? ""
          onText(full)
        }
        return full
      } finally {
        signal.removeEventListener("abort", stop)
      }
    },
  }
}

/** Gets the model ready: downloads it the first time (only after someone asks), then loads it. */
export function prepareLocalAi(): Promise<Runner> {
  if (runner) return Promise.resolve(runner)
  if (preparing) return preparing
  preparing = (async () => {
    await detectLocalAi()
    const current = engine
    if (!current) throw new Error(UNAVAILABLE_REASON)
    const model = MODEL_NAME[current]
    try {
      if (current === "chrome") {
        set({ status: "downloading", engine: current, model, progress: 0, text: "Getting Gemini Nano ready" })
        const session = await languageModel().create({
          ...LANGUAGE,
          monitor(m: EventTarget) {
            m.addEventListener("downloadprogress", (e: any) =>
              set({
                status: "downloading",
                engine: current,
                model,
                progress: e.loaded ?? 0,
                text: "Chrome is downloading Gemini Nano",
              }),
            )
          },
        })
        session.destroy?.()
        runner = chromeRunner()
      } else {
        set({ status: "downloading", engine: current, model, progress: 0, text: "Starting" })
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm")
        const mlc = await CreateMLCEngine(WEBLLM_MODEL, {
          appConfig: WEBLLM_CONFIG,
          initProgressCallback: (report) =>
            set({
              status: "downloading",
              engine: current,
              model,
              progress: report.progress,
              text: report.text,
            }),
        })
        remember(true)
        runner = webllmRunner(mlc)
      }
      set({ status: "ready", engine: current, model })
      return runner
    } catch (error) {
      preparing = null
      set({ status: "download", engine: current, model, size: DOWNLOAD_SIZE[current] })
      throw error
    }
  })()
  return preparing
}

/** Runs one prompt on the device, streaming the text as it is written. */
export async function runLocalAi(
  prompt: LocalPrompt,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<string> {
  const ready = await prepareLocalAi()
  return ready.generate(prompt, signal, onText)
}

/** Removes the downloaded open model from this browser. Chrome manages Gemini Nano itself. */
export async function forgetLocalModel(): Promise<void> {
  if (engine !== "webllm") return
  const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm")
  await deleteModelAllInfoInCache(WEBLLM_MODEL, WEBLLM_CONFIG)
  remember(false)
  runner = null
  preparing = null
  set({ status: "download", engine: "webllm", model: MODEL_NAME.webllm, size: DOWNLOAD_SIZE.webllm })
}

/** Explains a failed run in the app's words. */
export function localAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/memory|OOM|device lost|GPU/i.test(message))
    return "The model ran out of memory on this device. Close other tabs and try again."
  if (/user activation|gesture/i.test(message))
    return "The browser needs a tap to start the model. Try again."
  if (/network|fetch|Failed to fetch/i.test(message))
    return "The model's files didn't download. Check your connection and try again."
  return "The model stopped before it finished. Try again."
}
