import { Typography } from "@mui/material"
import Section from "components/Section"
import Link from "next/link"

interface AboutProps {}

const About: React.FC<AboutProps> = ({}) => {
  return (
    <Section title="About" color="success">
      <Typography variant="body1">
        This is a simple demo of the Vetkd library. It uses the{" "}
        <Link href="https://sdk.dfinity.org/docs/interface-spec/index.html">
          Internet Identity
        </Link>{" "}
        to authenticate users, and then uses Vetkd to encrypt and decrypt
        messages.
      </Typography>
      <Typography variant="body1">
        The demo is a simple note-taking app. You can create About, and then
        share them with other users. You can also view About that have been
        shared with you.
      </Typography>
      <Typography variant="body1">
        The demo is built with Rust and TypeScript. The source code is available
        on <Link href="https://github.com/B3Pay/vetkd_examples">GitHub</Link>.
      </Typography>
    </Section>
  )
}

export default About
