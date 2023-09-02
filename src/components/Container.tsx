import { Container } from "@mui/material"
import { useLoading } from "contexts/hooks/useLoading"
import { findLatestTrueKey as extractLoadingTitle } from "helper/utils"
import Loading from "./Loading"

const AppContainer: React.FC<React.PropsWithChildren> = ({ children }) => {
  const appLoading = useLoading()

  return (
    <Container
      fixed
      maxWidth="md"
      sx={{
        padding: 0.5,
        position: "relative",
      }}
    >
      {appLoading.global && (
        <Loading title={extractLoadingTitle(appLoading.effects)} />
      )}
      {children}
    </Container>
  )
}

export default AppContainer
