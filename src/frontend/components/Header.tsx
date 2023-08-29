import { Box } from "@mui/material"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import { useLocation, useNavigate } from "react-router-dom"

interface HeaderProps {}

const Header: React.FC<HeaderProps> = ({}) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <Tabs
      value={pathname}
      onChange={(_, newValue) => navigate(newValue)}
      variant="fullWidth"
      indicatorColor="secondary"
      textColor="secondary"
    >
      <Tab
        icon={
          <Box
            component="img"
            src="/logo.svg"
            sx={{ height: "1.5rem", width: "1.5rem" }}
            alt="Vetkd Logo"
          />
        }
        sx={{ maxWidth: "80px", minWidth: "80px" }}
        aria-label="Vetkd Logo"
        value="/"
      />
      <Tab label="Without Identity" value="/withoutii" />
      <Tab label="With Identity" value="/withii" />
      <Tab label="About" value="/about" />
    </Tabs>
  )
}

export default Header
