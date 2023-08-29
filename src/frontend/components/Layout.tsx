import { Container } from "@mui/material"
import { Outlet } from "react-router-dom"
import Footer from "./Footer"
import Header from "./Header"

interface LayoutProps {}

const Layout: React.FC<LayoutProps> = ({}) => {
  return (
    <Container maxWidth="sm" fixed>
      <Header />
      <Outlet />
      <Footer />
    </Container>
  )
}

export default Layout
