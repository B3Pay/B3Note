import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Address from "components/Address"
import Notes from "components/Notes"
import Section from "components/Section"
import { decyptNote, saveNote } from "contexts/helpers"
import { hex_decode, hex_encode } from "helper/utils"
import useCanister from "hook/useCanister"
import { useCallback, useState } from "react"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"

interface IdentityProps {}

const WithoutIdentity: React.FC<IdentityProps> = () => {
  const { backendCanister, backendCanisterPrincipal, principal } = useCanister()

  const [encryptInput, setEncryptInput] = useState("")

  const [decryptInput, setDecryptInput] = useState("")
  const [signatureInput, setSignatureInput] = useState("")
  const [decryptPassword, setDecryptPassword] = useState("")

  const decrypt = useCallback(async () => {
    if (!backendCanister) return

    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    console.log({ public_key: hex_encode(tsk.public_key()) })

    const signature = hex_decode(signatureInput)

    console.log({ signature: hex_encode(signature) })

    const ek_bytes_hex =
      await backendCanister.encrypted_ibe_decryption_key_for_caller_with_derivation(
        tsk.public_key(),
        signature
      )
    console.log(ek_bytes_hex)

    const pk_bytes_hex = await backendCanister.ibe_encryption_key()

    const k_bytes = tsk.decrypt(
      hex_decode(ek_bytes_hex),
      hex_decode(pk_bytes_hex),
      signature
    )

    console.log({ k_bytes })
    const ibe_ciphertext = IBECiphertext.deserialize(hex_decode(decryptInput))
    const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)
    console.log(ibe_plaintext)
    let decrypted = new TextDecoder().decode(ibe_plaintext)

    console.log(decrypted)
  }, [backendCanister, signatureInput, decryptPassword, decryptInput])

  const decryptWithPassword = useCallback(async () => {
    if (!backendCanister) return

    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    const signature = hex_decode(signatureInput)

    const [encrypted_note, ek_bytes_hex] =
      await backendCanister.read_with_one_time_password(
        "2",
        hex_encode(tsk.public_key()),
        hex_encode(signature),
        decryptPassword
      )

    const pk_bytes_hex = await backendCanister.ibe_encryption_key()

    const k_bytes = tsk.decrypt(
      hex_decode(ek_bytes_hex),
      hex_decode(pk_bytes_hex),
      signature
    )

    const encrypted_note_hex = hex_decode(encrypted_note)

    const ibe_ciphertext = IBECiphertext.deserialize(encrypted_note_hex)
    const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)

    let decrypted = new TextDecoder().decode(ibe_plaintext)

    console.log(decrypted)
  }, [backendCanister, signatureInput, decryptPassword])

  return (
    <Section title="Without Identity">
      <Address address={principal?.toString()}>Your principal is</Address>
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
            label="Encrypted"
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
            onClick={() =>
              decyptNote(decryptInput, signatureInput, decryptPassword)
            }
            variant="contained"
            color="secondary"
          >
            Decrypt
          </Button>
        </Section>
        <Section
          title="One-time Password"
          description="This is the one-time Password section"
          color="info"
          noShadow
        >
          <TextField
            color="info"
            type="text"
            label="Signature"
            value={signatureInput}
            onChange={(e) => setSignatureInput(e.target.value)}
          />
          <TextField
            color="info"
            type="passcode"
            label="Pass Code"
            value={decryptPassword}
            onChange={(e) => setDecryptPassword(e.target.value)}
          />
          <Button
            onClick={decryptWithPassword}
            variant="contained"
            color="info"
          >
            Decrypt
          </Button>
        </Section>
      </Stack>
    </Section>
  )
}

export default WithoutIdentity

export const config = { ssr: false }
