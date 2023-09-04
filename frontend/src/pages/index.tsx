import Section from "components/Section"
import TwoFactor from "components/TwoFactor"

interface HomeProps {}

const Home: React.FC<HomeProps> = ({}) => {
  return (
    <Section title="Home">
      <Section
        title="Authenticator"
        color="primary"
        description="This is the Authenticator section"
        noShadow
      >
        <TwoFactor />
      </Section>
    </Section>
  )
}

export default Home
