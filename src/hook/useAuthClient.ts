import { AuthClient } from "@dfinity/auth-client"
import { Principal } from "@dfinity/principal"
import {
  BACKEND_CANISTER_ID,
  IDENTITY_CANISTER_ID,
  IS_LOCAL,
} from "helper/config"
import { useCallback, useEffect, useState } from "react"
import { Backend } from "service/backend"
import { createManagmentActor } from "../service"

const useAuth = () => {
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false)
  const [authClient, setAuthClient] = useState<AuthClient>()
  const [backendCanister, setCanister] = useState<Backend>()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  const login = useCallback(async () => {
    const alreadyAuthenticated = await authClient?.isAuthenticated()

    if (alreadyAuthenticated) {
      setIsAuthenticated(true)
    } else {
      const identityProvider = IS_LOCAL
        ? `http://${IDENTITY_CANISTER_ID}.localhost:8080`
        : "https://identity.ic0.app/#authorize"

      const maxTimeToLive = 24n * 60n * 60n * 1000n * 1000n * 1000n

      setIsAuthenticating(true)

      authClient?.login({
        identityProvider,
        maxTimeToLive,
        onSuccess: () => {
          setIsAuthenticating(false)
          setIsAuthenticated(true)
        },
        onError: (err) => {
          setIsAuthenticating(false)
          console.error(err)
        },
      })
    }
  }, [authClient])

  // const initActor = useCallback(async () => {
  //   if (!authClient) return
  //   const { actor } = await createBackendActor(authClient.getIdentity())

  //   setCanister(actor)
  // }, [authClient])

  const logout = () => {
    setIsAuthenticated(false)
    setCanister(undefined)

    authClient?.logout({ returnTo: "/" })
  }

  const getManagmentActor = useCallback(() => {
    if (!authClient) return

    const management = createManagmentActor(authClient.getIdentity())

    return management
  }, [authClient])

  useEffect(() => {
    if (authClient == null) {
      setIsAuthenticating(true)
      AuthClient.create().then(async (client) => {
        await client?.isAuthenticated()
        setIsAuthenticating(false)
        setAuthClient(client)
      })
    }
  }, [authClient])

  useEffect(() => {
    if (authClient != null) {
      ;(async () => {
        const authenticated = await authClient?.isAuthenticated()
        if (authenticated) {
          setIsAuthenticated(true)
        }
      })()
    }
  }, [authClient])

  // useEffect(() => {
  //   if (isAuthenticating) return
  //   if (isAuthenticated) initActor()
  //   const { actor } = await createBackendActor()
  //   setCanister(actor)
  // }, [isAuthenticated, initActor])

  const principal =
    authClient?.getIdentity().getPrincipal() || Principal.anonymous()

  const backendCanisterPrincipal = Principal.fromText(BACKEND_CANISTER_ID)

  return {
    authClient,
    isAuthenticated,
    isAuthenticating,
    login,
    logout,
    principal,
    backendCanister,
    backendCanisterPrincipal,
    getManagmentActor,
  }
}

export default useAuth
