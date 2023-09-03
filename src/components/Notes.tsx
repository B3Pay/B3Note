import { Box } from "@mui/material"
import { fetchNotes } from "contexts/helpers"
import { useBackendNotes } from "contexts/hooks/useBackend"
import { hex_encode } from "helper/utils"
import { useEffect } from "react"
import Note from "./Note"
import Section from "./Section"
import SimpleCard from "./SimpleCard"

interface NotesProps {}

const Notes: React.FC<NotesProps> = ({}) => {
  const notes = useBackendNotes()

  useEffect(() => {
    fetchNotes()
  }, [])

  return (
    <Section
      title="Notes"
      noShadow
      color="success"
      description="Notes are encrypted with your identity"
      action={fetchNotes}
    >
      <Box>
        {notes.length > 0 ? (
          notes.map((note) => <Note key={hex_encode(note.id)} {...note} />)
        ) : (
          <SimpleCard color="text.secondary" bgcolor="warning.light">
            No notes!
          </SimpleCard>
        )}
      </Box>
    </Section>
  )
}

export default Notes
