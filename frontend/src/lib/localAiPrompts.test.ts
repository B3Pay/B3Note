import { describe, expect, it } from "vitest"
import { AI_ACTIONS } from "./ai"
import { cleanLocalResult, localActionPrompt, localAskPrompt } from "./localAiPrompts"

describe("on-device prompts", () => {
  it("has a prompt for every assistant action, with the note in it", () => {
    for (const action of AI_ACTIONS) {
      const prompt = localActionPrompt(action.id, "Buy milk", "Persian")
      expect(prompt.user).toContain("Buy milk")
      expect(prompt.maxTokens).toBeGreaterThan(0)
    }
    expect(localActionPrompt("Translate", "Hi", "Persian").user).toContain("into Persian")
  })

  it("asks from the notes it is given", () => {
    const prompt = localAskPrompt("When is the meeting?", "### Thursday\nMeet at 3")
    expect(prompt.user).toContain("### Thursday")
    expect(prompt.user).toMatch(/Question: When is the meeting\?$/)
    expect(prompt.system).toContain("Your notes don't say.")
  })

  it("tidies a suggested title", () => {
    expect(cleanLocalResult("SuggestTitle", 'Title: "Budget meeting with Sara."\nMore')).toBe(
      "Budget meeting with Sara",
    )
    expect(cleanLocalResult("SuggestTitle", "# **Gift ideas**")).toBe("Gift ideas")
  })

  it("drops a chatty preamble but keeps the result", () => {
    expect(cleanLocalResult("Summarize", "Here's a summary:\n\n- One\n- Two")).toBe("- One\n- Two")
    expect(cleanLocalResult("Improve", "  Clear text.  ")).toBe("Clear text.")
  })
})
