import { Typography } from "@mui/material"
import Section from "./Section"

interface HomeProps {}

const Home: React.FC<HomeProps> = ({}) => {
  return (
    <Section title="Home">
      <Typography variant="body1">
        This is the homepage of the Vetkd frontend.
      </Typography>
    </Section>
  )
}

export default Home
