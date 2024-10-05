import { AuthClient } from "@dfinity/auth-client"
import { Principal } from "@dfinity/principal"
import { RematchDispatch } from "@rematch/core"
import { getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import { InitializeArgs } from "contexts/types/backend"
import { IDENTITY_CANISTER_ID, IS_LOCAL } from "helper/config"
import { generateSubaccount } from "helper/subaccount"
import { hex_decode } from "helper/utils"
import { createBackendActor } from "service"

const initEffect = (dispatch: RematchDispatch<RootModel>) => ({
  importWasm: async () => {
    const { TransportSecretKey, IBECiphertext, verify_offline } = await import(
      "vetkd-utils"
    )

    return {
      TransportSecretKey,
      IBECiphertext,
      verify_offline,
    }
  },
  initialize: async (args: InitializeArgs, rootState) => {
    if (rootState.backend.initialized) return

    try {
      let { TransportSecretKey, IBECiphertext, verify_offline } =
        await dispatch.backend.importWasm()

      let randomSeed = args.randomSeed
        ? hex_decode(args.randomSeed)
        : window.crypto.getRandomValues(new Uint8Array(32))

      const transportSecretKey = new TransportSecretKey(randomSeed)

      const userIdentity = Principal.anonymous()

      const { backendActor, canisterId } = await createBackendActor()

      const ibeEncryptionKey = await backendActor.ibe_encryption_key()

      dispatch.backend.INIT({
        userIdentity,
        canisterId,
        ibeEncryptionKey,
        transportSecretKey,
        backendActor,
        randomSeed,
        verify_offline,
        ibeDeserialize: (arg) => IBECiphertext.deserialize(arg as Uint8Array),
        ibeEncrypt: (
          drivationId: Uint8Array,
          msg: Uint8Array,
          seed: Uint8Array
        ) =>
          IBECiphertext.encrypt(
            ibeEncryptionKey as Uint8Array,
            drivationId,
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
    try {
      await AuthClient.create().then(async (client) => {
        const alreadyAuthenticated = await client?.isAuthenticated()

        if (alreadyAuthenticated) {
          return dispatch.backend.fetch_keys(client)
        }

        if (!alreadyAuthenticated) {
          const identityProvider = IS_LOCAL
            ? `http://${IDENTITY_CANISTER_ID}.localhost:8080`
            : "https://identity.ic0.app/#authorize"

          const maxTimeToLive = 24n * 60n * 60n * 1000n * 1000n * 1000n

          client?.login({
            identityProvider,
            maxTimeToLive,
            onSuccess: () => dispatch.backend.fetch_keys(client),
            onError: (err) => {
              throw err
            },
          })
        }
      })
    } catch (e) {
      console.log(e)

      dispatch.backend.SET_ERROR({
        globalError: e,
      })
    }
  },
  fetch_keys: async (authClient) => {
    const { transportSecretKey } = getBackendStates()

    try {
      const { backendActor, canisterId } = await createBackendActor(
        authClient.getIdentity()
      )

      const userIdentity = authClient.getIdentity().getPrincipal()

      const verificationKey =
        await backendActor.symmetric_key_verification_key()

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
        authClient,
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
  logout: async () => {
    const { authClient } = getBackendStates()

    try {
      authClient.logout({ returnTo: "/withii" })
    } catch (e) {
      console.log(e)

      dispatch.backend.SET_ERROR({
        globalError: e,
      })
    }
  },
})

export default initEffect
