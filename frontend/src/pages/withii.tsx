import Address from "components/Address"
import NewNote from "components/NewNote"
import Notes from "components/Notes"
import Section from "components/Section"
import {
  useBackendIsInitialized,
  useUserIdentity,
} from "contexts/hooks/useBackend"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()
  const principal = useUserIdentity()

  return (
    <Section
      title="With Identity"
      loading={!backendInitailized}
      loadingTitle="Initializing"
    >
      <Address address={principal.toString()}>Your principal is</Address>
      <Notes />
      <NewNote />
    </Section>
  )
}

export default WithoutII
