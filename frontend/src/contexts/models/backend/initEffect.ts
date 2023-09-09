import { Principal } from "@dfinity/principal"
import { RematchDispatch } from "@rematch/core"
import { getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import { InitializeArgs } from "contexts/types/backend"
import { generateSubaccount } from "helper/subaccount"
import { createBackendActor } from "service"

const initEffect = (dispatch: RematchDispatch<RootModel>) => ({
  initialize: async (args: InitializeArgs, rootState) => {
    if (rootState.backend.initialized) return

    try {
      let { TransportSecretKey, IBECiphertext, verify_offline } = await import(
        "vetkd-utils"
      )

      let seed = window.crypto.getRandomValues(new Uint8Array(32))

      const transportSecretKey = new TransportSecretKey(seed)

      const userIdentity =
        args.identity?.getPrincipal() || Principal.anonymous()

      const { backendActor, canisterId } = await createBackendActor(
        args.identity
      )

      const verificationKey =
        await backendActor.symmetric_key_verification_key()

      const ibeEncryptionKey = await backendActor.ibe_encryption_key()

      dispatch.backend.INIT({
        userIdentity,
        canisterId,
        verificationKey,
        ibeEncryptionKey,
        transportSecretKey,
        backendActor,
        verify_offline,
        ibeDeserialize: (arg) => IBECiphertext.deserialize(arg as Uint8Array),
        ibeEncrypt: (msg, seed) =>
          IBECiphertext.encrypt(
            ibeEncryptionKey as Uint8Array,
            generateSubaccount(userIdentity),
            msg,
            seed
          ),
      })
    } catch (e) {
      console.log(e)
      dispatch.backend.SET_ERROR({
        globalError: e,
      })
    }
  },
  login: async () => {
    const {
      backendActor,
      verificationKey,
      canisterId,
      transportSecretKey,
      userIdentity,
    } = getBackendStates()

    try {
      const encryptedKey =
        await backendActor.encrypted_symmetric_key_for_caller(
          transportSecretKey.public_key()
        )

      const rawKey = transportSecretKey.decrypt_and_hash(
        encryptedKey as Uint8Array,
        verificationKey as Uint8Array,
        generateSubaccount(userIdentity),
        32,
        new TextEncoder().encode("aes-256-gcm")
      )

      dispatch.backend.LOGIN({
        userIdentity,
        canisterId,
        backendActor,
        transportSecretKey,
        rawKey,
        encryptedKey,
        verificationKey,
      })
    } catch (e) {
      console.log(e)

      dispatch.backend.SET_ERROR({
        globalError: e,
      })
    }
  },
})

export default initEffect
