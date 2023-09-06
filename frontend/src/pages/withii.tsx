import { Principal } from "@dfinity/principal"
import Address from "components/Address"
import NewNote from "components/NewNote"
import Notes from "components/Notes"
import Section from "components/Section"
import { useBackendIsInitialized } from "contexts/hooks/useBackend"

interface IdentityProps {}

const WithoutII: React.FC<IdentityProps> = () => {
  const backendInitailized = useBackendIsInitialized()

  return (
    <Section
      title="Without Identity"
      loading={!backendInitailized}
      loadingTitle="Initializing"
    >
      <Address address={Principal.anonymous()?.toString()}>
        Your principal is
      </Address>
      <Notes />
      <NewNote />
    </Section>
  )
}

export default WithoutII
