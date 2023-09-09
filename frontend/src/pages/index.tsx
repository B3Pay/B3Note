"use client"
import { Button, Typography } from "@mui/material"
import Address from "components/Address"
import Section from "components/Section"
import Link from "next/link"

interface HomeProps {}

const Home: React.FC<HomeProps> = ({}) => {
  return (
    <Section title="Home">
      <Section title="What is this?" color="success" noShadow>
        <Typography variant="body1" color="grey.700" component="div">
          This is a simple demo of the Vetkd library. It demonstrates how to use
          Vetkd to encrypt and decrypt messages.
          <br />
          The demo is a simple note-taking app. You can write secret notes and
          then share them with other users. You can also view secret notes that
          have been shared with you.
          <br />
          The demo app runs fully on Internet Computer blockchain. The backend
          is written in Rust and the frontend is written in TypeScript.
          <br />
          The backend is deployed as a canister with this address:{" "}
          <Address address={process.env.BACKEND_CANISTER_ID!} overflow="auto" />
          and the frontend is deployed as a static site on this address:
          <Address
            address={process.env.FRONTEND_CANISTER_ID!}
            overflow="auto"
          />
          The source code is available on{" "}
          <Link href="https://github.com/B3Pay/vetkd_examples">GitHub</Link>
        </Typography>
        <Button href="https://github.com/B3Pay/vetkd_examples">
          View Source Code
        </Button>
      </Section>
    </Section>
  )
}

export default Home
