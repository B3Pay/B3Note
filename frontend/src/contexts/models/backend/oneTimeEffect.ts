import { randomNumber } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { RematchDispatch } from "@rematch/core"
import { getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import {
  DecryptWithSignatureArgs,
  GenerateOneTimeKeyArgs,
  RequestOneTimeKeyArgs,
  SetOneTimeSignatureArgs,
} from "contexts/types/backend"
import { generateSubaccount } from "helper/subaccount"
import {
  compileError,
  hex_decode,
  hex_encode,
  stringToBigIntAndUint8Array,
} from "helper/utils"

const oneTimeEffect = (dispatch: RematchDispatch<RootModel>) => ({
  generate_one_time_key: async (args: SetOneTimeSignatureArgs) => {
    const { backendActor, transportSecretKey } = getBackendStates()

    const publicKey = transportSecretKey.public_key()

    const { input, id } = stringToBigIntAndUint8Array(args.id)

    // Sign the id using the TransportSecretKey
    const signature = transportSecretKey.sign(input)

    try {
      await backendActor.set_one_time_key(id, publicKey)
    } catch (e) {
      console.log(e)
      dispatch.backend.SET_ERROR({
        globalError: e,
      })
    }

    return signature
  },
  decrypt_with_one_time_key: async (args: DecryptWithSignatureArgs) => {
    const {
      backendActor,
      ibeEncryptionKey,
      ibeDeserialize,
      transportSecretKey,
    } = getBackendStates()

    try {
      const { id, signature } = await dispatch.backend.verify_signature_offline(
        args
      )

      const result = await backendActor.read_with_one_time_key(
        id,
        signature,
        transportSecretKey.public_key()
      )

      if ("Err" in result) {
        throw new Error(result.Err)
      }

      const [encryptedNote, ibeDecryptionKey] = result.Ok

      const k_bytes = transportSecretKey.decrypt(
        ibeDecryptionKey as Uint8Array,
        ibeEncryptionKey as Uint8Array,
        generateSubaccount(Principal.anonymous())
      )

      const ibe_ciphertext = ibeDeserialize(encryptedNote as Uint8Array)
      const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)

      let decrypted = new TextDecoder().decode(ibe_plaintext)

      return decrypted
    } catch (e) {
      dispatch.backend.SET_ERROR({
        decryptionError: {
          [args.id.toString()]: compileError(e),
        },
      })
      console.log(e)
    }
  },
  verify_signature_offline: async (args: DecryptWithSignatureArgs) => {
    const { backendActor, verify_offline } = getBackendStates()

    const { input, id } = stringToBigIntAndUint8Array(args.id)
    const signature = hex_decode(args.signature)

    const pub_key = await backendActor.get_one_time_key(BigInt(args.id))

    if (signature.length !== 96) {
      throw new Error("Error::Signature is not valid!")
    }
    // Verify the signature using the one time key
    const res = verify_offline(pub_key as Uint8Array, signature, input)

    if (!res) {
      throw new Error("Error::Signature is not valid!")
    }

    return { id, signature }
  },
  request_one_time_key: async (args: RequestOneTimeKeyArgs) => {
    // const { backendActor, verificationKey, userIdentity, transportSecretKey } =
    //   getBackendStates()
    // try {
    //   const ek_bytes_hex = await backendActor.request_two_factor_authentication(
    //     transportSecretKey.public_key()
    //   )
    //   const verification_key = transportSecretKey.decrypt_and_hash(
    //     hex_decode(ek_bytes_hex),
    //     verificationKey as Uint8Array,
    //     generateSubaccount(userIdentity),
    //     32,
    //     new TextEncoder().encode("aes-256-gcm")
    //   )
    //   console.log({ verification_key: hex_encode(verification_key) })
    // } catch (e) {
    //   console.log(e)
    // }
  },
  generate_authenticator_code: async (args: GenerateOneTimeKeyArgs) => {
    const { transportSecretKey } = getBackendStates()

    const generate = () => {
      const randomRandom = randomNumber()

      const code = (randomRandom % 1000000).toString().padStart(6, "0")

      const signature = hex_encode(transportSecretKey.sign(hex_decode(code)))

      console.log({ code, signature })
    }

    const interval = setInterval(generate, 30000)
    generate()
  },
})

export default oneTimeEffect
