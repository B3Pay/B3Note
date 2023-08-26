import {
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material"
import React from "react"
import SectionCard from "./components/SectionCard"
import useAuth from "./useAuthClient"

interface IdentityProps {}

const Identity: React.FC<IdentityProps> = () => {
  const {
    isAuthenticated,
    isAuthenticating,
    canister,
    login,
    logout,
    principal,
  } = useAuth()

  const getCode = async () => {
    if (!canister) {
      return
    }

    const code = await canister.symmetric_key_verification_key()
    console.log(code)
  }

  return (
    <Container maxWidth="sm" fixed>
      <SectionCard title="Identity" description="This is the identity section">
        {isAuthenticating ? (
          <CircularProgress />
        ) : isAuthenticated ? (
          <Stack spacing={2}>
            <Typography variant="h6">Welcome, {principal}</Typography>
            <Button onClick={getCode} variant="contained">
              Get Code
            </Button>
            <Button onClick={logout} color="error">
              Logout
            </Button>
          </Stack>
        ) : (
          <Box>
            <Typography variant="h6">You are not authenticated</Typography>
            <Button onClick={login}>Login</Button>
          </Box>
        )}
      </SectionCard>
    </Container>
  )
}

export default Identity
