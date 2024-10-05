import { randomNumber } from "@dfinity/agent"
import { RematchDispatch } from "@rematch/core"
import { getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import {
  GenerateOneTimeKeyArgs,
  RequestOneTimeKeyArgs,
} from "contexts/types/backend"
import { hex_decode, hex_encode } from "helper/utils"

const keyEffect = (dispatch: RematchDispatch<RootModel>) => ({
  request_one_time_key: async (args: RequestOneTimeKeyArgs) => {
    const { backendActor, ibeEncryptionKey, transportSecretKey } =
      getBackendStates()

    // try {
    //   const ek_bytes_hex =
    //     await backendActor.request_two_factor_authentication(
    //       transportSecretKey.public_key()
    //     )

    //   const verification_key = transportSecretKey.decrypt_and_hash(
    //     hex_decode(ek_bytes_hex),
    //     hex_decode(pk_bytes_hex),
    //     Principal.anonymous().toUint8Array(),
    //     32,
    //     new TextEncoder().encode("aes-256-gcm")
    //   )

    //   console.log({ verification_key: hex_encode(verification_key) })
    // } catch (e) {
    //   console.log(e)
    // }
  },
  generate_one_time_key: async (args: GenerateOneTimeKeyArgs) => {
    const { transportSecretKey } = getBackendStates()

    const generate = () => {
      const randomRandom = randomNumber()

      const code = (randomRandom % 1000000).toString().padStart(6, "0")

      const signature = hex_encode(transportSecretKey.sign(hex_decode(code)))

      console.log({ code, signature })
    }

    const interval = setInterval(generate, 30_000)
    generate()
  },
})

export default keyEffect
