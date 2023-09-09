"use client"
import { Principal } from "@dfinity/principal"
import { Button, TextField } from "@mui/material"
import Alert from "@mui/material/Alert"
import Address from "components/Address"
import LoadingDots from "components/LoadingDots"
import NewNote from "components/NewText"
import Section from "components/Section"
import Texts from "components/Texts"
import { decyptWithSignature } from "contexts/helpers"
import { useBackendIsInitialized } from "contexts/hooks/useBackend"
import { useDecryptionError } from "contexts/hooks/useError"
import { useBackendLoading } from "contexts/hooks/useLoading"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()
  const searchParams = useSearchParams()
  const { push } = useRouter()

  const [decryptedNote, setDecryptedNote] = useState<string>()
  const [signature, setSignature] = useState("")
  const [id, setId] = useState("")

  useEffect(() => {
    if (searchParams.has("id") && searchParams.has("signature")) {
      let signature = searchParams.get("signature")!
      setId(searchParams.get("id")!)
      setSignature(signature)

      if (signature.length !== 192) {
        setDecryptedNote("Invalid")
      }
    }
  }, [searchParams])

  const decryptLoading = useBackendLoading("decrypt_with_signature")
  const decryptError = useDecryptionError(id)
  console.log(decryptError)
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
      {decryptedNote ? (
        <>
          <Section
            title="Decrypted Text"
            color="secondary"
            description="You can now see the decrypted text. The Link is not valid anymore!"
            noShadow
          >
            <TextField
              fullWidth
              multiline
              color="secondary"
              rows={4}
              type="text"
              label="Text"
              value={decryptedNote}
              InputProps={{
                readOnly: true,
              }}
            />
          </Section>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setDecryptedNote("")
              setSignature("")
              setId("")

              push("/")
            }}
          >
            Destroy Text
          </Button>
        </>
      ) : signature ? (
        <>
          <Section
            title="Decrypt"
            color="info"
            description="Decrypt a text with a signature."
            noShadow
          >
            {decryptError && <Alert severity="error">{decryptError}</Alert>}
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
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setSignature("")
              setId("")
              push("/withoutii")
            }}
          >
            Go Back
          </Button>
        </>
      ) : (
        <>
          <Texts />
          <NewNote />
        </>
      )}
    </Section>
  )
}

export default WithoutII
