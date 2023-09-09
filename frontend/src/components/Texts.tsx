import { Box } from "@mui/material"
import { fetchDecryptionKey, fetchNotes } from "contexts/helpers"
import {
  useBackendIsInitialized,
  useBackendNotes,
  useDecryptionKeyIsSet,
} from "contexts/hooks/useBackend"
import { useEffect } from "react"
import LoadingDots from "./LoadingDots"
import Section from "./Section"
import SimpleCard from "./SimpleCard"
import Text from "./Text"

interface TextsProps {}

const Texts: React.FC<TextsProps> = ({}) => {
  const notes = useBackendNotes()
  const backendInitailized = useBackendIsInitialized()
  const decryptionKeyIsSet = useDecryptionKeyIsSet()
  const haveNotes = notes.length > 0

  useEffect(() => {
    if (backendInitailized) fetchNotes()
  }, [backendInitailized])

  useEffect(() => {
    if (haveNotes && !decryptionKeyIsSet) fetchDecryptionKey()
  }, [haveNotes, decryptionKeyIsSet])

  return (
    <Section
      title="Notes"
      noShadow
      color="success"
      description="Notes are encrypted with your identity"
      action={fetchNotes}
    >
      <Box>
        {!backendInitailized ? (
          <SimpleCard color="text.secondary" bgcolor="warning.light">
            <LoadingDots title="Loading notes" />
          </SimpleCard>
        ) : !haveNotes ? (
          <SimpleCard color="text.secondary" bgcolor="warning.light">
            No notes found
          </SimpleCard>
        ) : (
          notes.map((note) => (
            <Text
              canDecrypt={decryptionKeyIsSet}
              key={note.id.toString()}
              {...note}
            />
          ))
        )}
      </Box>
    </Section>
  )
}

export default Texts
