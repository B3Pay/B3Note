"use client"
import { Button } from "@mui/material"
import Address from "components/Address"
import NewNote from "components/NewText"
import Section from "components/Section"
import Texts from "components/Texts"
import TwoFactor from "components/TwoFactor"
import { initBackend, loginWithII, logout } from "contexts/helpers"
import {
  useBackendIsInitialized,
  useUserIdentity,
} from "contexts/hooks/useBackend"
import { useAllBackendLoading } from "contexts/hooks/useLoading"
import { extractLoadingTitle } from "helper/utils"
import { useEffect } from "react"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()
  const backendAllLoading = useAllBackendLoading()
  const identity = useUserIdentity()

  useEffect(() => {
    if (!backendInitailized) {
      initBackend()
    }
  }, [backendInitailized])

  const loadingTitle = extractLoadingTitle(backendAllLoading)

  return (
    <Section
      title="With Identity"
      loading={!!loadingTitle}
      loadingTitle={loadingTitle}
    >
      {identity.isAnonymous() ? (
        <Section title="login with your identity" color="primary" noShadow>
          <Button onClick={loginWithII}>Login</Button>
        </Section>
      ) : (
        <>
          <Address address={identity.toString()}>Your principal is</Address>
          <Section
            title="Authenticator"
            color="primary"
            description="This is the Authenticator section"
            noShadow
          >
            <TwoFactor />
          </Section>
          <Texts />
          <NewNote />
          <Button onClick={logout} color="warning">
            Logout
          </Button>
        </>
      )}
    </Section>
  )
}

export default WithoutII
