"use client"
import { Button, Typography } from "@mui/material"
import Address from "components/Address"
import Section from "components/Section"
import { useRouter } from "next/router"

interface HomeProps {}

const Home: React.FC<HomeProps> = ({}) => {
  const { push } = useRouter()
  return (
    <Section title="Home">
      <Typography variant="h4">Welcome to B3Note</Typography>
      <Typography variant="h5">
        Your decentralized and secure note-sharing platform.
      </Typography>
      <Section title="What is this?" color="secondary" noShadow>
        <Typography variant="body1" color="grey.700" component="div">
          B3Note is a decentralized platform built on the Internet Computer that
          allows you to create and share notes. With strong encryption and
          blockchain-based verification, B3Note emphasizes privacy and security.
          The platform offers two distinct features: anonymous note sharing and
          authenticated note sharing.
        </Typography>
      </Section>
      <Button
        variant="contained"
        color="secondary"
        onClick={() => push("/withoutii")}
      >
        Create Anonymous Note
      </Button>

      <Section title="How does it work?" color="info" noShadow>
        <Typography variant="body1" color="grey.700" component="div">
          B3Note uses a combination of the Internet Identity and Internet
          Computer to create a secure and decentralized note-sharing platform.
          The Internet Identity is used to authenticate users and the vetkd
          technology is used to encrypt and decrypt notes.
        </Typography>
      </Section>
      <Button variant="contained" color="info" onClick={() => push("/withii")}>
        Create Authenticated Note
      </Button>
      <Address address={process.env.BACKEND_CANISTER_ID!} overflow="auto">
        Backend Canister ID
      </Address>
      <Button href="https://github.com/B3Pay/vetkd_examples" color="warning">
        View Source Code
      </Button>
    </Section>
  )
}

export default Home
