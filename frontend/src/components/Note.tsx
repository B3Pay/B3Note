import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { AccordionDetails, Button, TextField } from "@mui/material"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import Typography from "@mui/material/Typography"
import { decyptIBENote, generateOneTimeLink } from "contexts/helpers"
import { useDecryptedNoteById } from "contexts/hooks/useBackend"
import { useBackendLoading } from "contexts/hooks/useLoading"
import type { UserText } from "declarations/backend/backend.did"
import { generateLink } from "helper/utils"
import { useEffect, useState } from "react"
import LoadingDots from "./LoadingDots"
import Section from "./Section"

interface NoteProps extends UserText {}

const Note: React.FC<NoteProps> = ({ id, text }) => {
  const [generatedLink, setGeneratedLink] = useState("")

  const decryptedNote = useDecryptedNoteById(id)
  const textLoading = decryptedNote === undefined

  const generatedLinkLoading = useBackendLoading("generate_one_time_link")

  useEffect(() => {
    decyptIBENote(id, text)
  }, [id, text])

  const handleGenerateLink = async () => {
    let signature = await generateOneTimeLink(id)

    let link = generateLink(id, signature)

    setGeneratedLink(link)
  }
  return (
    <Accordion
      color="primary"
      sx={{
        position: "relative",
      }}
    >
      <AccordionSummary
        disabled={textLoading}
        expandIcon={<ExpandMoreIcon />}
        aria-controls="texts-content"
      >
        {textLoading ? (
          <LoadingDots title="Decrypting Note" />
        ) : (
          <Typography>{id.toString()}</Typography>
        )}
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
          title="One-time Link"
          description="This is the one-time link for the text above. You can share this
          link with anyone and they will be able to see the text. This link
          can only be used once."
          color="info"
          noShadow
        >
          {(generatedLink || generatedLinkLoading) && (
            <TextField
              fullWidth
              multiline
              rows={4}
              type="text"
              label="Link"
              value={generatedLink}
              InputProps={{
                readOnly: true,
              }}
            />
          )}
          <Button onClick={handleGenerateLink} variant="contained">
            Generate Link
          </Button>
        </Section>
      </AccordionDetails>
    </Accordion>
  )
}

export default Note
