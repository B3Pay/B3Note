import { Button, Stack, Typography } from "@mui/material"
import Section from "components/Section"
import { requestOneTimeKey } from "contexts/helpers"
import { useOneTimeKey } from "contexts/hooks/useBackend"

interface HomeProps {}

const Home: React.FC<HomeProps> = ({}) => {
  const { code, signature } = useOneTimeKey()
  return (
    <Section title="Home">
      <Section
        title="Authenticator"
        color="primary"
        description="This is the Authenticator section"
        noShadow
      >
        {code ? (
          <Stack spacing={2}>
            <Typography variant="h5" component="div">
              {code}
            </Typography>
            <Typography variant="h5" component="div">
              {signature}
            </Typography>
          </Stack>
        ) : (
          <Button onClick={() => requestOneTimeKey()} variant="contained">
            Request One Time Key
          </Button>
        )}
      </Section>
    </Section>
  )
}

export default Home
