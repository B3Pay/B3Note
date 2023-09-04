import { Principal } from "@dfinity/principal"
import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Address from "components/Address"
import LoadingDots from "components/LoadingDots"
import Notes from "components/Notes"
import Section from "components/Section"
import { saveNoteIBE } from "contexts/helpers"
import { useBackendIsInitialized } from "contexts/hooks/useBackend"
import { useBackendLoading } from "contexts/hooks/useLoading"
import { useState } from "react"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const [encryptInput, setEncryptInput] = useState("")

  const savingLoading = useBackendLoading("save_ibe_user_note")

  const backendInitailized = useBackendIsInitialized()

  return (
    <Section
      title="Without Identity"
      loading={!backendInitailized}
      loadingTitle="Initializing"
    >
      <Address address={Principal.anonymous()?.toString()}>
        Your principal is
      </Address>
      <Notes />
      <Stack spacing={2}>
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
            onClick={() => saveNoteIBE(encryptInput)}
            variant="contained"
            disabled={savingLoading}
          >
            {savingLoading ? <LoadingDots title="Saving" /> : "Save"}
          </Button>
        </Section>
      </Stack>
    </Section>
  )
}

export default WithoutII
