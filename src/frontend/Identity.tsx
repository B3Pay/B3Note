import { Box, Button, CircularProgress, Typography } from "@mui/material"
import React from "react"
import useAuth from "./useAuthClient"

interface IdentityProps {}

const Identity: React.FC<IdentityProps> = () => {
  const { isAuthenticated, isAuthenticating, login, logout, principal } =
    useAuth()

  return (
    <Box>
      {isAuthenticating ? (
        <CircularProgress />
      ) : isAuthenticated ? (
        <Box>
          <Typography variant="h6">Welcome, {principal}</Typography>
          <Button variant="contained" color="primary" onClick={logout}>
            Logout
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="h6">You are not authenticated</Typography>
          <Button variant="contained" color="primary" onClick={login}>
            Login
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default Identity
