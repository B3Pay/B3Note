import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { useCallback, useState } from "react"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"
import Section from "./components/Section"
import useAuth from "./useAuthClient"
import { hex_decode, hex_encode } from "./utils"

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

    const signature = tsk.sign(hex_decode(encryptPassword))

    console.log({
      signature: hex_encode(signature),
      publicKey: hex_encode(tsk.public_key()),
    })

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

    console.log({ public_key: hex_encode(tsk.public_key_g2()) })

    const signature = hex_decode(
      "9383baf28cfa14792d7723272221c9e432335a6967fbf81e2361febf92f9972a68e0ea7645ddd62654df56018b2458c6"
    )

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
    let encrypted = new TextDecoder().decode(ibe_plaintext)

    console.log(encrypted)
  }, [backendCanister, decryptPassword, decryptInput])

  return (
    <Section title="With Identity">
      {isAuthenticating ? (
        <CircularProgress />
      ) : isAuthenticated ? (
        <Stack spacing={2}>
          <Typography variant="body1">
            Your principal is <b>{principal?.toString()}</b>
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
          <Button onClick={login} color="success">
            Login
          </Button>
        </Box>
      )}
    </Section>
  )
}

export default WithIdentity
