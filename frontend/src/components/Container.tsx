import { Container } from "@mui/material"
import Footer from "./Footer"
import Header from "./Header"

const AppContainer: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Container
      fixed
      maxWidth="md"
      sx={{
        padding: 0.5,
        position: "relative",
      }}
    >
      <Header />
      {children}
      <Footer />
    </Container>
  )
}

export default AppContainer
