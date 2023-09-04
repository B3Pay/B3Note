import { Box } from "@mui/material"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import { useGlobalLoading } from "contexts/hooks/useLoading"
import { useRouter } from "next/router"

interface HeaderProps {}

const Header: React.FC<HeaderProps> = ({}) => {
  const { pathname, push } = useRouter()
  const appLoading = useGlobalLoading()

  return (
    <Tabs
      value={pathname}
      onChange={(_, newValue) => push(newValue)}
      variant="fullWidth"
      indicatorColor="secondary"
      textColor="secondary"
      sx={{
        boxShadow: 2,
      }}
    >
      <Tab
        value="/404"
        sx={{
          position: "absolute",
          left: "-100vw",
        }}
      />
      <Tab
        icon={
          <Box
            component="img"
            src="/logo.svg"
            sx={{
              height: "2.3rem",
              width: "2.3rem",
              filter: appLoading ? "grayscale(100%)" : "none",
            }}
            alt="Vetkd Logo"
          />
        }
        sx={{ maxWidth: "80px", minWidth: "80px", maxHeight: "54px" }}
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
