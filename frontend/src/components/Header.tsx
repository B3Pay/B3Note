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
      TabIndicatorProps={{
        style: {
          display: "none",
        },
      }}
      textColor="secondary"
      sx={{
        boxShadow: 2,
      }}
    >
      <Tab
        icon={
          <Box
            component="img"
            src="/logo.svg"
            sx={{
              height: "36px",
              width: "36px",
              filter: appLoading ? "grayscale(100%)" : "none",
            }}
            alt="Vetkd Logo"
          />
        }
        sx={{ maxWidth: "80px", minWidth: "80px", maxHeight: "60px" }}
        aria-label="Vetkd Logo"
        value="/"
      />
      <Tab
        value="/404"
        sx={{
          position: "absolute",
          left: "-1000vh",
        }}
      />
      <Tab label="Without Identity" value="/withoutii" />
      <Tab label="With Identity" value="/withii" />
      <Tab label="Logs" value="/logs" />
    </Tabs>
  )
}

export default Header
