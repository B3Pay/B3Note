"use client"
import { Button } from "@mui/material"
import Address from "components/Address"
import NewNote from "components/NewText"
import Section from "components/Section"
import Texts from "components/Texts"
import {
  useBackendIsInitialized,
  useUserIdentity,
} from "contexts/hooks/useBackend"
import useAuthClient from "hook/useAuthClient"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()
  const principal = useUserIdentity()

  const { login, logout } = useAuthClient()

  return (
    <Section
      title="With Identity"
      loading={!backendInitailized}
      loadingTitle="Initializing"
    >
      {principal.isAnonymous() ? (
        <Section title="login with your identity" color="primary" noShadow>
          <Button onClick={login}>Login</Button>
        </Section>
      ) : (
        <>
          <Address address={principal.toString()}>Your principal is</Address>
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
