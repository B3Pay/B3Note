import {
  Box,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material"
import React, { PropsWithChildren } from "react"
import LoadingDots from "./LoadingDots"

interface LoadingProps extends PropsWithChildren {
  dark?: boolean
  circle?: boolean
  title?: string
  description?: string
}

const Loading: React.FC<LoadingProps> = ({
  dark,
  circle,
  title,
  description,
  children,
}) => {
  return (
    <Stack
      position="absolute"
      top="0"
      bottom="0"
      left="0"
      right="0"
      alignItems="center"
      justifyContent="center"
      zIndex={1000}
      sx={{
        backdropFilter: "blur(2px)",
      }}
    >
      <Typography fontWeight="bold" color={dark ? "white" : "gray.600"}>
        <LoadingDots title={title} />
      </Typography>
      <Typography color={dark ? "white" : "gray.600"}>{description}</Typography>
      <Box width="20vw">
        {children ? (
          children
        ) : circle ? (
          <CircularProgress color="secondary" />
        ) : (
          <LinearProgress />
        )}
      </Box>
    </Stack>
  )
}

export default Loading
