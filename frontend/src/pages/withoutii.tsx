import { Principal } from "@dfinity/principal"
import { Button, TextField } from "@mui/material"
import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import Address from "components/Address"
import LoadingDots from "components/LoadingDots"
import NewNote from "components/NewNote"
import Notes from "components/Notes"
import Section from "components/Section"
import { decyptWithSignature } from "contexts/helpers"
import { useBackendIsInitialized } from "contexts/hooks/useBackend"
import { useDecryptionError } from "contexts/hooks/useError"
import { useBackendLoading } from "contexts/hooks/useLoading"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()
  const searchParams = useSearchParams()

  const [decryptedNote, setDecryptedNote] = useState<string>()
  const [signature, setSignature] = useState("")
  const [id, setId] = useState("")

  useEffect(() => {
    if (searchParams.has("id") && searchParams.has("signature")) {
      setId(searchParams.get("id")!)
      setSignature(searchParams.get("signature")!)
    }
  }, [searchParams])

  const decryptLoading = useBackendLoading("decrypt_with_signature")
  const decryptError = useDecryptionError(id)

  const handleDecryptNote = async () => {
    let note = await decyptWithSignature(id, signature)

    setDecryptedNote(note)
  }

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
      <Section
        title="Decrypt"
        color="info"
        description="Decrypt a note with a signature."
        noShadow
      >
        {decryptError && (
          <Alert severity="error">
            <AlertTitle>{decryptError}</AlertTitle>
          </Alert>
        )}
        <TextField
          type="text"
          color="info"
          label="id"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <TextField
          multiline
          rows={4}
          type="text"
          color="info"
          label="Signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />
        <Button
          onClick={handleDecryptNote}
          variant="contained"
          color="info"
          disabled={decryptLoading}
        >
          {decryptLoading ? <LoadingDots title="Decrypting" /> : "Decrypt"}
        </Button>
      </Section>
      {decryptedNote && (
        <Section
          title="Decrypted Note"
          color="info"
          description="This is the decrypted note. The note is only decrypted locally and is never sent to the backend. The backend is only used to verify the signature."
          noShadow
        >
          <TextField
            fullWidth
            multiline
            color="info"
            rows={4}
            type="text"
            label="Note"
            value={decryptedNote}
            InputProps={{
              readOnly: true,
            }}
          />
        </Section>
      )}
      <NewNote />
    </Section>
  )
}

export default WithoutII
