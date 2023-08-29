import { Typography } from "@mui/material"
import Section from "./Section"

interface NoMatchProps {}

const NoMatch: React.FC<NoMatchProps> = ({}) => {
  return (
    <Section
      title="page not found"
      sx={{
        borderRadius: 0,
        textAlign: "center",
      }}
    >
      <Typography variant="h1" color="secondary">
        404
      </Typography>
      <Typography>The page you are looking for does not exist.</Typography>
    </Section>
  )
}

export default NoMatch
