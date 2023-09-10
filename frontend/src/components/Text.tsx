import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { AccordionDetails, Button } from "@mui/material"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import Typography from "@mui/material/Typography"
import { decyptIBENote, generateOneTimeLink } from "contexts/helpers"
import { useDecryptedNoteById } from "contexts/hooks/useBackend"
import { useBackendLoading } from "contexts/hooks/useLoading"
import type { UserText } from "declarations/backend/backend.did"
import { generateLink } from "helper/utils"
import { useEffect, useState } from "react"
import Address from "./Address"
import LoadingDots from "./LoadingDots"
import Section from "./Section"

interface TextProps extends UserText {
  canDecrypt: boolean
}

const Text: React.FC<TextProps> = ({ canDecrypt, id, text }) => {
  const [generatedLink, setGeneratedLink] = useState("")

  const decryptedNote = useDecryptedNoteById(id)
  const textLoading = decryptedNote === undefined

  const generatedLinkLoading = useBackendLoading("generate_one_time_key")

  useEffect(() => {
    if (canDecrypt) decyptIBENote(id, text as Uint8Array)
  }, [canDecrypt, id, text])

  const handleGenerateLink = async () => {
    let signature = await generateOneTimeLink(id)
    console.log(signature)
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
          <LoadingDots title="Decrypting Text" />
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
          {generatedLink && (
            <Address address={generatedLink} iconColor="info" />
          )}
          <Button
            onClick={handleGenerateLink}
            variant="contained"
            disabled={generatedLinkLoading}
          >
            {generatedLinkLoading ? (
              <LoadingDots title="Generating Link" />
            ) : (
              "Generate Link"
            )}
          </Button>
        </Section>
      </AccordionDetails>
    </Accordion>
  )
}

export default Text
