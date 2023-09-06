import { Typography } from "@mui/material"
import Section from "components/Section"
import { useRouter } from "next/router"

interface DecryptProps {}

const Decrypt: React.FC<DecryptProps> = ({}) => {
  const router = useRouter()

  return (
    <Section title="Decrypt">
      <Section color="primary" title="Read Note" noShadow>
        <Typography variant="body1">{JSON.stringify(router.query)}</Typography>
      </Section>
    </Section>
  )
}

export default Decrypt
