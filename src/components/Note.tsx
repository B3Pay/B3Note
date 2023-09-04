import type { UserNote } from "@declarations/backend/backend.did"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { AccordionDetails, Button, TextField } from "@mui/material"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import Typography from "@mui/material/Typography"
import {
  decyptNote,
  decyptWithOneTimeKey,
  setOneTimeKey,
} from "contexts/helpers"
import { useDecryptedNoteById } from "contexts/hooks/useBackend"
import { hex_encode } from "helper/utils"
import { useEffect, useState } from "react"
import Section from "./Section"

interface NoteProps extends UserNote {}

const Note: React.FC<NoteProps> = ({ id, note }) => {
  const [signatureInput, setSignatureInput] = useState("")
  const decryptedNote = useDecryptedNoteById(hex_encode(id))

  useEffect(() => {
    decyptNote(hex_encode(note))
  }, [note])

  return (
    <Accordion color="primary">
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="notes-content"
      >
        <Typography>{hex_encode(id)}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography
          variant="body1"
          paddingBottom={1}
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {decryptedNote}
        </Typography>
        <Section
          title="One-time Password"
          description="This is the one-time Password section"
          color="info"
          noShadow
        >
          <Button
            onClick={() => setOneTimeKey(id as Uint8Array)}
            variant="contained"
          >
            Generate Link
          </Button>
          <TextField
            color="info"
            type="text"
            label="Signature"
            value={signatureInput}
            onChange={(e) => setSignatureInput(e.target.value)}
          />
          <Button
            onClick={() =>
              decyptWithOneTimeKey(id as Uint8Array, signatureInput)
            }
            variant="contained"
            color="info"
          >
            Decrypt
          </Button>
        </Section>
      </AccordionDetails>
    </Accordion>
  )
}

export default Note
