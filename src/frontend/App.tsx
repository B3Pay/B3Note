import { Container, Typography } from "@mui/material"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import {
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom"
import WithIdentity from "./WithII"
import WithoutIdentity from "./WithoutII"
import Section from "./components/Section"

interface AppProps {}

const App: React.FC<AppProps> = ({}) => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="/" element={<WithoutIdentity />} />
        <Route path="/withoutii" element={<WithoutIdentity />} />
        <Route path="/withii" element={<WithIdentity />} />
        <Route path="*" element={<NoMatch />} />
      </Route>
    </Routes>
  )
}

export default App

interface LayoutProps {}

const Layout: React.FC<LayoutProps> = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <Container maxWidth="sm" fixed>
      <Tabs
        value={pathname === "/" ? "/withoutii" : pathname}
        onChange={(_, newValue) => navigate(newValue)}
        variant="fullWidth"
        indicatorColor="secondary"
        textColor="secondary"
      >
        <Tab label="Without Identity" value="/withoutii" />
        <Tab label="With Identity" value="/withii" />
      </Tabs>
      <Outlet />
    </Container>
  )
}

function NoMatch() {
  return (
    <Section
      sx={{
        textAlign: "center",
      }}
    >
      <Typography variant="h1" color="secondary">
        404
      </Typography>
      <Typography>page not found</Typography>
    </Section>
  )
}
