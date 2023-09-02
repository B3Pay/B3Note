import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { AccordionDetails, Button, TextField } from "@mui/material"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import Typography from "@mui/material/Typography"
import { setOneTimeKey } from "contexts/helpers"
import { UserNote } from "declarations/backend/backend.did"
import { hex_decode, hex_encode } from "helper/utils"
import useCanister from "hook/useCanister"
import { useCallback, useMemo, useState } from "react"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"
import Section from "./Section"

interface NoteProps extends UserNote {}

const Note: React.FC<NoteProps> = ({ id, note }) => {
  const { backendCanister, backendCanisterPrincipal } = useCanister()
  const { ek_bytes_hex, pk_bytes_hex } = { ek_bytes_hex: "", pk_bytes_hex: "" }

  const [signatureInput, setSignatureInput] = useState("")
  const [decryptPassword, setDecryptPassword] = useState("")
  const [encryptPassword, setEncryptPassword] = useState("")

  const decryptedNote = useMemo(() => {
    if (!backendCanister) return

    const tsk_seed = window.crypto.getRandomValues(new Uint8Array(32))
    const tsk = new TransportSecretKey(tsk_seed)

    const k_bytes = tsk.decrypt(
      hex_decode(ek_bytes_hex),
      hex_decode(pk_bytes_hex),
      backendCanisterPrincipal.toUint8Array()
    )

    const ibe_ciphertext = IBECiphertext.deserialize(note as Uint8Array)
    const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)
    return new TextDecoder().decode(ibe_plaintext)
  }, [backendCanister])

  const decryptWithPassword = useCallback(async () => {
    if (!backendCanister) return

    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    const signature = hex_decode(signatureInput)

    const [encrypted_note, ek_bytes_hex] =
      await backendCanister.read_with_one_time_password(
        id,
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

  const setOneTimePassword = useCallback(async () => {
    if (!backendCanister) return

    const pk_bytes_hex = await backendCanister.ibe_encryption_key()

    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    console.log({
      publicKey: hex_encode(tsk.public_key()),
    })

    const signature = tsk.sign(hex_decode(encryptPassword))

    console.log({ signature: hex_encode(signature) })

    const ibe_ciphertext = IBECiphertext.encrypt(
      hex_decode(pk_bytes_hex),
      signature,
      note as Uint8Array,
      seed
    )

    let result = hex_encode(ibe_ciphertext.serialize())

    console.log(result)
  }, [backendCanister, encryptPassword, note])

  return (
    <Accordion color="primary">
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="notes-content"
      >
        <Typography>{Number(id)}</Typography>
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
          <TextField
            type="password"
            label="Password"
            value={encryptPassword}
            onChange={(e) => setEncryptPassword(e.target.value)}
          />
          <Button
            onClick={() => setOneTimeKey(id, encryptPassword)}
            variant="contained"
          >
            Share With One-time Password
          </Button>
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
      </AccordionDetails>
    </Accordion>
  )
}

export default Note
