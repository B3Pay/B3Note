import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from "@mui/material"
import { UserNote } from "declarations/backend/backend.did"
import { useCallback, useEffect, useState } from "react"
import { hex_encode } from "../helper/utils"
import useCanister from "../hook/useCanister"
import Section from "./Section"

interface NotesProps {}

const Notes: React.FC<NotesProps> = ({}) => {
  const [notes, setNotes] = useState<UserNote[]>([])

  const { backendCanister } = useCanister()

  const fetchNotes = useCallback(async () => {
    if (!backendCanister) return

    const notes = await backendCanister.user_notes()

    setNotes(notes)
  }, [backendCanister])

  useEffect(() => {
    fetchNotes()
  }, [backendCanister])

  return (
    <Section title="Notes" noFrame color="info">
      <Box>
        {notes.length > 0 ? (
          notes.map((note) => (
            <Accordion key={note.id.toString()} color="primary">
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="notes-content"
              >
                <Typography>{note.id.toString()}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>{hex_encode(note.note as Uint8Array)}</Typography>
              </AccordionDetails>
            </Accordion>
          ))
        ) : (
          <Typography>No notes</Typography>
        )}
      </Box>
    </Section>
  )
}

export default Notes
