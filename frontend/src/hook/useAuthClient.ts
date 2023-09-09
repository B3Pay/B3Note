import { AuthClient } from "@dfinity/auth-client"
import { IDENTITY_CANISTER_ID, IS_LOCAL } from "helper/config"
import { useCallback, useEffect, useState } from "react"

const useAuthClient = () => {
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false)
  const [authClient, setAuthClient] = useState<AuthClient>()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

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

  const logout = () => {
    setIsAuthenticated(false)

    authClient?.logout({ returnTo: "/" })
  }

  return {
    isAuthenticated,
    isAuthenticating,
    login,
    logout,
  }
}

export default useAuthClient
