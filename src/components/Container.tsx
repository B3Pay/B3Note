import { Box, Container } from "@mui/material"
import { useBackendIsInitialized } from "contexts/hooks/useBackend"
import { useLoading } from "contexts/hooks/useLoading"
import { extractLoadingTitle } from "helper/utils"
import Footer from "./Footer"
import Header from "./Header"
import Loading from "./Loading"

const AppContainer: React.FC<React.PropsWithChildren> = ({ children }) => {
  const appLoading = useLoading()
  const backendInitailized = useBackendIsInitialized()

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
      {appLoading.global && (
        <Loading title={extractLoadingTitle(appLoading.effects)} />
      )}
      {!backendInitailized ? (
        <Box sx={{ textAlign: "center" }}>Backend is not initialized</Box>
      ) : (
        children
      )}
      <Footer />
    </Container>
  )
}

export default AppContainer
