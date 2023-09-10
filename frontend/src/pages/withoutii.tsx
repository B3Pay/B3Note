"use client"
import { Principal } from "@dfinity/principal"
import { Button, TextField, Typography } from "@mui/material"
import Alert from "@mui/material/Alert"
import Address from "components/Address"
import LoadingDots from "components/LoadingDots"
import NewNote from "components/NewText"
import Section from "components/Section"
import Texts from "components/Texts"
import { decyptWithSignature, initBackend } from "contexts/helpers"
import {
  useBackendIsInitialized,
  useBackendItem,
} from "contexts/hooks/useBackend"
import { useDecryptionError } from "contexts/hooks/useError"
import {
  useAllBackendLoading,
  useBackendLoading,
} from "contexts/hooks/useLoading"
import {
  extractLoadingTitle,
  hex_encode,
  nanoToHumanReadable,
} from "helper/utils"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()
  const backendAllLoading = useAllBackendLoading()

  const randomSeed = useBackendItem("randomSeed")
  const createdAt = useBackendItem("createdAt")

  const searchParams = useSearchParams()
  const { push, reload } = useRouter()

  const [decryptedNote, setDecryptedNote] = useState<string>()
  const [signature, setSignature] = useState("")
  const [seed, setSeed] = useState("")
  const [id, setId] = useState("")

  useEffect(() => {
    if (searchParams.has("id") && searchParams.has("signature")) {
      let signature = searchParams.get("signature")!
      setId(searchParams.get("id")!)
      setSignature(signature)

      if (signature.length !== 192) {
        return setDecryptedNote("Not a valid signature.")
      }

      initBackend()
    }

    if (searchParams.has("seed")) {
      let seed = searchParams.get("seed")!
      setSeed(seed)
    }
  }, [searchParams, randomSeed])

  const decryptLoading = useBackendLoading("decrypt_with_one_time_key")
  const decryptError = useDecryptionError(id)

  const handleDecryptNote = async () => {
    let note = await decyptWithSignature(id, signature)
    console.log(note)
    setDecryptedNote(note)
  }

  const loadingTitle = extractLoadingTitle(backendAllLoading)

  return (
    <Section
      title="Without Identity"
      loading={!!loadingTitle}
      loadingTitle={loadingTitle}
    >
      {signature ? (
        decryptedNote ? (
          <>
            <Section
              title="Decrypted Text"
              color="secondary"
              description="You can now see the decrypted text."
              noShadow
            >
              <Typography
                variant="body1"
                paddingBottom={1}
                sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {decryptedNote}
              </Typography>
            </Section>
            <Typography variant="body1" color="text.secondary">
              Note: The text is only visible once. The link is not valid
              anymore.
            </Typography>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setDecryptedNote("")
                setSignature("")
                setId("")

                push("/withoutii", {
                  query: undefined,
                }).then(() =>
                  push("/withoutii", {
                    query: {
                      seed: hex_encode(randomSeed as Uint8Array),
                    },
                  })
                )
              }}
            >
              Try your own
            </Button>
          </>
        ) : (
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
              <Typography variant="body1" color="text.secondary">
                Note: The text will be decrypted with the signature. The
                signature is only valid for one-time.
              </Typography>
              <Button
                onClick={handleDecryptNote}
                variant="contained"
                color="info"
                disabled={decryptLoading}
              >
                {decryptLoading ? (
                  <LoadingDots title="Decrypting" />
                ) : (
                  "Decrypt"
                )}
              </Button>
            </Section>
          </>
        )
      ) : !backendInitailized ? (
        <Section title="Login Using Seed" color="primary" noShadow>
          <TextField
            fullWidth
            multiline
            color="primary"
            type="text"
            label="Seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              push("/withoutii", {
                query: {
                  seed,
                },
              }).then(() => initBackend(seed))
            }
          >
            Login
          </Button>
          <Typography variant="body1" color="text.secondary">
            Or generate a new random seed.
          </Typography>
          <Button
            onClick={() => {
              let seed = hex_encode(
                window.crypto.getRandomValues(new Uint8Array(32))
              )
              push("/withoutii", {
                query: {
                  seed,
                },
              }).then(() => initBackend(seed))
            }}
          >
            Random Login
          </Button>
        </Section>
      ) : (
        <>
          <Address address={Principal.anonymous()?.toString()}>
            Your principal is
          </Address>
          <Address
            address={hex_encode(randomSeed as Uint8Array)}
            prefix="Your Seed"
          >
            was created at {nanoToHumanReadable(createdAt)}
          </Address>
          <Texts />
          <NewNote />
          <Typography variant="body1" color="text.secondary">
            Note: After 1 hour your public key will be deleted. your data will
            be lost.
          </Typography>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              push("/withoutii", {
                query: undefined,
              }).then(() => reload())
            }}
          >
            Logout
          </Button>
        </>
      )}
    </Section>
  )
}

export default WithoutII
