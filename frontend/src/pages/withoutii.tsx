import { Principal } from "@dfinity/principal"
import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Address from "components/Address"
import Notes from "components/Notes"
import Section from "components/Section"
import { decyptNote, saveNote } from "contexts/helpers"
import { useBackendIsInitialized } from "contexts/hooks/useBackend"
import { useState } from "react"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const [encryptInput, setEncryptInput] = useState("")

  const [decryptInput, setDecryptInput] = useState("")
  const [signatureInput, setSignatureInput] = useState("")
  const [decryptPassword, setDecryptPassword] = useState("")

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
          <Button onClick={() => saveNote(encryptInput)} variant="contained">
            Save
          </Button>
        </Section>
        <Section
          title="Decryption"
          description="This is the decryption section"
          color="secondary"
          noShadow
        >
          <TextField
            color="secondary"
            type="text"
            label="Encrypted Note"
            value={decryptInput}
            onChange={(e) => setDecryptInput(e.target.value)}
          />
          <TextField
            color="secondary"
            type="text"
            label="Signature"
            value={signatureInput}
            onChange={(e) => setSignatureInput(e.target.value)}
          />
          <TextField
            color="secondary"
            type="password"
            label="Password"
            value={decryptPassword}
            onChange={(e) => setDecryptPassword(e.target.value)}
          />
          <Button
            onClick={() => decyptNote(decryptInput)}
            variant="contained"
            color="secondary"
          >
            Decrypt
          </Button>
        </Section>
      </Stack>
    </Section>
  )
}

export default WithoutII
