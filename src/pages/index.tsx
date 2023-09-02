import { randomNumber } from "@dfinity/agent"
import { Button, Stack, Typography } from "@mui/material"
import Section from "components/Section"
import { hex_decode, hex_encode } from "helper/utils"
import useAuth from "hook/useAuthClient"
import { useEffect, useState } from "react"
import { TransportSecretKey } from "vetkd-utils"

interface HomeProps {}

const Home: React.FC<HomeProps> = ({}) => {
  const { backendCanister, principal } = useAuth()

  const [code, setCode] = useState("")
  const [signature, setSignature] = useState("")

  const [twoFactorVerificationKey, setTwoFactorVerificationKey] =
    useState<Uint8Array>()
  const [transportSecretKey, setTransportSecretKey] =
    useState<TransportSecretKey>()

  async function requestTwoFactorAuthentication() {
    if (!backendCanister) return

    const seed = window.crypto.getRandomValues(new Uint8Array(32))
    const tsk = new TransportSecretKey(seed)

    try {
      const ek_bytes_hex =
        await backendCanister.request_two_factor_authentication(
          tsk.public_key()
        )

      console.log({ public_key: hex_encode(tsk.public_key()) })

      const pk_bytes_hex = await backendCanister.two_factor_verification_key()

      const verification_key = tsk.decrypt_and_hash(
        hex_decode(ek_bytes_hex),
        hex_decode(pk_bytes_hex),
        principal.toUint8Array(),
        32,
        new TextEncoder().encode("aes-256-gcm")
      )

      setTwoFactorVerificationKey(verification_key)
      setTransportSecretKey(tsk)
    } catch (e) {
      console.log(e)
    }
  }

  useEffect(() => {
    if (!transportSecretKey) return

    const generate = () => {
      const randomRandom = randomNumber()

      const code = (randomRandom % 1000000).toString().padStart(6, "0")

      const signature = hex_encode(transportSecretKey.sign(hex_decode(code)))

      console.log({ code, signature })

      setCode(code)
      setSignature(signature)
    }

    const interval = setInterval(generate, 30_000)

    generate()

    return () => clearInterval(interval)
  }, [transportSecretKey])

  return (
    <Section title="Home">
      <Section
        title="Authenticator"
        color="primary"
        description="This is the Authenticator section"
        noShadow
      >
        {twoFactorVerificationKey ? (
          <Stack spacing={2}>
            <Typography variant="h5" component="div">
              {code}
            </Typography>
            <Typography variant="h5" component="div">
              {signature}
            </Typography>
          </Stack>
        ) : (
          <Button onClick={requestTwoFactorAuthentication} variant="contained">
            Request Authenticator
          </Button>
        )}
      </Section>
    </Section>
  )
}

export default Home

export const config = { ssr: false }
