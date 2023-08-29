import Section from "./Section"

interface AboutProps {}

const About: React.FC<AboutProps> = ({}) => {
  return (
    <Section title="About">
      <p>
        This is a simple demo of the Vetkd library. It uses the{" "}
        <a
          href="
          https://sdk.dfinity.org/docs/interface-spec/index.html
          "
        >
          Internet Identity
        </a>{" "}
        to authenticate users, and then uses Vetkd to encrypt and decrypt
        messages.
      </p>
      <p>
        The demo is a simple note-taking app. You can create About, and then
        share them with other users. You can also view About that have been
        shared with you.
      </p>
      <p>
        The demo is built with React and TypeScript. The source code is
        available on{" "}
        <a href="github.com/dfinity/examples/tree/master/encrypted_About">
          GitHub
        </a>
        .
      </p>
    </Section>
  )
}

export default About
