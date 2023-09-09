import { Principal } from "@dfinity/principal"
import { RematchDispatch } from "@rematch/core"
import { getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import {
  DecryptWithSignatureArgs,
  SetOneTimeSignatureArgs,
} from "contexts/types/backend"
import { generateSubaccount } from "helper/subaccount"
import {
  compileError,
  hex_decode,
  stringToBigIntAndUint8Array,
} from "helper/utils"

const oneTimeEffect = (dispatch: RematchDispatch<RootModel>) => ({
  generate_one_time_link: async (args: SetOneTimeSignatureArgs) => {
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

  decrypt_with_signature: async (args: DecryptWithSignatureArgs) => {
    const {
      backendActor,
      ibeEncryptionKey,
      ibeDeserialize,
      verify_offline,
      transportSecretKey,
    } = getBackendStates()

    try {
      const pub_key = await backendActor.get_one_time_key(BigInt(args.id))

      const res = verify_offline(
        pub_key as Uint8Array,
        hex_decode(args.id),
        hex_decode(args.signature)
      )
      console.log({ res })

      if (args.signature.length !== 192) {
        throw new Error("Error::Signature is not valid!")
      }

      const id = BigInt(args.id)
      const signature = hex_decode(args.signature)

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
})

export default oneTimeEffect
