import { createContext, useContext } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { cn } from "./ui"

/** The source line of the task list item being rendered. */
const TaskLine = createContext<number | null>(null)
/** Called with that line when its checkbox is clicked. */
const ToggleTask = createContext<((line: number) => void) | null>(null)

// Single line breaks are kept, as people expect in notes.
const REMARK_PLUGINS = [remarkGfm, remarkBreaks]

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  li: ({ node, ...props }) => (
    <TaskLine.Provider value={node?.position?.start.line ?? null}>
      <li {...props} />
    </TaskLine.Provider>
  ),
  input: function TaskCheckbox({ node: _node, type, checked, ...props }) {
    const line = useContext(TaskLine)
    const toggle = useContext(ToggleTask)
    if (type !== "checkbox") return <input type={type} {...props} />
    const interactive = toggle !== null && line !== null
    return (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={!interactive}
        onChange={() => interactive && toggle(line)}
        className="mr-2 h-4 w-4 translate-y-0.5 cursor-pointer accent-brand-600 disabled:cursor-default"
        aria-label="Toggle task"
      />
    )
  },
}

/**
 * Renders a note's markdown (GitHub flavored). Links open in a new tab, raw
 * HTML is not rendered, and task checkboxes are clickable when
 * `onToggleTask` is given (it receives the task's 1-based source line).
 */
export function Markdown({
  source,
  onToggleTask,
  className,
}: {
  source: string
  onToggleTask?: (line: number) => void
  className?: string
}) {
  return (
    <ToggleTask.Provider value={onToggleTask ?? null}>
      <div className={cn("prose-note", className)}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components} skipHtml>
          {source}
        </ReactMarkdown>
      </div>
    </ToggleTask.Provider>
  )
}
