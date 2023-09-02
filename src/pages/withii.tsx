import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import Address from "components/Address"
import LoadingDots from "components/LoadingDots"
import Notes from "components/Notes"
import Section from "components/Section"
import { useCallback, useState } from "react"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"
import { hex_decode, hex_encode } from "../helper/utils"
import useAuth from "../hook/useAuthClient"

interface IdentityProps {}

const WithIdentity: React.FC<IdentityProps> = () => {
  const {
    isAuthenticated,
    isAuthenticating,
    backendCanister,
    backendCanisterPrincipal,
    login,
    logout,
    principal,
  } = useAuth()

  const [encryptInput, setEncryptInput] = useState("")
  const [encryptPassword, setEncryptPassword] = useState("")
  const [decryptInput, setDecryptInput] = useState("")
  const [decryptPassword, setDecryptPassword] = useState("")

  const encrypt = useCallback(async () => {
    if (!backendCanister) return

    const pk_bytes_hex = await backendCanister.ibe_encryption_key()

    const message_encoded = new TextEncoder().encode(encryptInput)
    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    const tsk = new TransportSecretKey(seed)

    console.log({ publicKey: hex_encode(tsk.public_key()) })

    const ibe_ciphertext = IBECiphertext.encrypt(
      hex_decode(pk_bytes_hex),
      principal.toUint8Array(),
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

    const ek_bytes_hex =
      await backendCanister.encrypted_ibe_decryption_key_for_caller(
        tsk.public_key()
      )
    console.log(ek_bytes_hex)

    const pk_bytes_hex = await backendCanister.ibe_encryption_key()

    const k_bytes = tsk.decrypt(
      hex_decode(ek_bytes_hex),
      hex_decode(pk_bytes_hex),
      backendCanisterPrincipal.toUint8Array()
    )

    console.log(k_bytes)
    const ibe_ciphertext = IBECiphertext.deserialize(hex_decode(decryptInput))
    const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)
    console.log(ibe_plaintext)
    let encrypted = new TextDecoder().decode(ibe_plaintext)

    console.log(encrypted)
  }, [backendCanister, backendCanisterPrincipal, decryptPassword, decryptInput])

  return (
    <Section title="With Identity">
      {isAuthenticated ? (
        <Stack spacing={2}>
          <Address address={principal?.toString()}>Your principal is</Address>
          <Notes />
          <Section
            title="Encryption"
            color="primary"
            description="This is the encryption section"
            noShadow
          >
            <TextField
              type="text"
              label="Message"
              multiline
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
              type="password"
              label="Password"
              value={decryptPassword}
              onChange={(e) => setDecryptPassword(e.target.value)}
            />
            <Button onClick={decrypt} variant="contained" color="secondary">
              Decrypt
            </Button>
          </Section>
          <Button onClick={logout} color="error" variant="contained">
            Logout
          </Button>
        </Stack>
      ) : (
        <Box>
          <Typography variant="h6" mb={2}>
            Login to continue
          </Typography>
          <Button onClick={login} color="success" disabled={isAuthenticating}>
            {isAuthenticating ? <LoadingDots title="Logging in" /> : "Login"}
          </Button>
        </Box>
      )}
    </Section>
  )
}

export default WithIdentity

export const config = { ssr: false }
