import { Box } from "@mui/material"
import { fetchNotes } from "contexts/helpers"
import {
  useBackendIsInitialized,
  useBackendNotes,
} from "contexts/hooks/useBackend"
import { hex_encode } from "helper/utils"
import { useEffect } from "react"
import Note from "./Note"
import Section from "./Section"
import SimpleCard from "./SimpleCard"

interface NotesProps {}

const Notes: React.FC<NotesProps> = ({}) => {
  const notes = useBackendNotes()
  const backendInitailized = useBackendIsInitialized()

  useEffect(() => {
    if (backendInitailized) fetchNotes()
  }, [backendInitailized])

  return (
    <Section
      title="Notes"
      noShadow
      color="success"
      description="Notes are encrypted with your identity"
      action={fetchNotes}
    >
      <Box>
        {!backendInitailized ? (
          <SimpleCard color="text.secondary" bgcolor="warning.light">
            Loading notes...
          </SimpleCard>
        ) : notes.length === 0 ? (
          <SimpleCard color="text.secondary" bgcolor="warning.light">
            No notes found
          </SimpleCard>
        ) : (
          notes.map((note) => <Note key={hex_encode(note.id)} {...note} />)
        )}
      </Box>
    </Section>
  )
}

export default Notes
