import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { hex_decode, hex_encode } from "frontend/helper/utils"
import { useCallback, useState } from "react"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"
import useCanister from "../hook/useCanister"
import Notes from "./Notes"
import Section from "./Section"

interface IdentityProps {}

const WithoutIdentity: React.FC<IdentityProps> = () => {
  const { backendCanister, backendCanisterPrincipal, principal } = useCanister()

  const [encryptInput, setEncryptInput] = useState("")
  const [encryptPassword, setEncryptPassword] = useState("")

  const [decryptInput, setDecryptInput] = useState("")
  const [signatureInput, setSignatureInput] = useState("")
  const [decryptPassword, setDecryptPassword] = useState("")

  const encrypt = useCallback(async () => {
    if (!backendCanister) return

    const pk_bytes_hex = await backendCanister.ibe_encryption_key()

    const message_encoded = new TextEncoder().encode(encryptInput)
    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    console.log({
      publicKey: hex_encode(tsk.public_key_g2()),
    })

    const signature = tsk.sign(hex_decode(encryptPassword))

    console.log({ signature: hex_encode(signature) })

    const ibe_ciphertext = IBECiphertext.encrypt(
      hex_decode(pk_bytes_hex),
      signature,
      message_encoded,
      seed
    )

    let result = hex_encode(ibe_ciphertext.serialize())

    console.log(result)
  }, [backendCanister, encryptPassword, encryptInput])

  const decrypt = useCallback(async () => {
    if (!backendCanister) return

    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    console.log({ public_key: hex_encode(tsk.public_key()) })

    const signature = hex_decode(signatureInput)

    console.log({ signature: hex_encode(signature) })

    const ek_bytes_hex =
      await backendCanister.encrypted_ibe_decryption_key_for_caller(
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

    console.log(k_bytes)
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
        BigInt(1),
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
      <Notes />
      <Stack spacing={2}>
        <Typography variant="body1">
          Your principal is Anonymouse(<b>{principal?.toString()}</b>)
        </Typography>
        <Typography variant="body1">
          Your backend canister principal is{" "}
          <b>{backendCanisterPrincipal.toString()}</b>
        </Typography>
        <Section
          title="Encryption"
          color="primary"
          description="This is the encryption section"
          noFrame
        >
          <TextField
            type="text"
            label="Message"
            value={encryptInput}
            onChange={(e) => setEncryptInput(e.target.value)}
          />
          <TextField
            type="password"
            label="Password"
            value={encryptPassword}
            onChange={(e) => setEncryptPassword(e.target.value)}
          />
          <Button onClick={encrypt} variant="contained">
            Encrypt
          </Button>
        </Section>
        <Section
          title="Decryption"
          description="This is the decryption section"
          color="secondary"
          noFrame
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
          <Button onClick={decrypt} variant="contained" color="secondary">
            Decrypt
          </Button>
        </Section>
        <Section
          title="One-time Password"
          description="This is the one-time Password section"
          color="info"
          noFrame
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
