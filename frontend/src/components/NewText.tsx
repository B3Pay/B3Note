import Button from "@mui/material/Button"
import TextField from "@mui/material/TextField"
import { saveNoteIBE } from "contexts/helpers"
import { useBackendLoading } from "contexts/hooks/useLoading"
import { useState } from "react"
import LoadingDots from "./LoadingDots"
import Section from "./Section"

interface NewTextProps {}

const NewText: React.FC<NewTextProps> = ({}) => {
  const [encryptInput, setEncryptInput] = useState("")

  const savingLoading = useBackendLoading("save_IBE_user_note")

  const handleSaveNote = () => {
    saveNoteIBE(encryptInput)
  }

  return (
    <Section
      title="New Note"
      color="primary"
      description="Write a new note"
      noShadow
    >
      <TextField
        multiline
        rows={4}
        type="text"
        label="Message"
        value={encryptInput}
        onChange={(e) => setEncryptInput(e.target.value)}
      />
      <Button
        onClick={handleSaveNote}
        variant="contained"
        disabled={savingLoading}
      >
        {savingLoading ? <LoadingDots title="Saving" /> : "Save"}
      </Button>
    </Section>
  )
}

export default NewText
