// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Markdown } from "../src/components/Markdown"

afterEach(cleanup)

const source = "Intro\n\n- [ ] first\n- [x] second\n- [ ] third\n\n[site](https://example.com)"

describe("Markdown", () => {
  it("reports the source line of the clicked task, even in StrictMode", () => {
    const onToggle = vi.fn()
    render(
      <StrictMode>
        <Markdown source={source} onToggleTask={onToggle} />
      </StrictMode>,
    )
    const boxes = screen.getAllByRole("checkbox", { name: "Toggle task" }) as HTMLInputElement[]
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false])
    fireEvent.click(boxes[1])
    fireEvent.click(boxes[2])
    expect(onToggle.mock.calls).toEqual([[4], [5]])
  })

  it("renders read-only tasks, safe links and no raw HTML", () => {
    const { container } = render(<Markdown source={`${source}\n\n<img src=x onerror=alert(1)>`} />)
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).disabled).toBe(true)
    const link = screen.getByRole("link", { name: "site" })
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    expect(container.querySelector("img")).toBeNull()
  })
})
