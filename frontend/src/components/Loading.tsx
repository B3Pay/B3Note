import {
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
  title?: string | null
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
      left="0"
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      zIndex={1000}
      borderRadius={1}
      sx={{
        backgroundColor: "transparent",
        backdropFilter: "blur(2px)",
      }}
    >
      <Typography fontWeight="bold" color={dark ? "white" : "gray.600"}>
        <LoadingDots title={title} />
      </Typography>
      <Typography color={dark ? "white" : "gray.600"}>{description}</Typography>
      <Stack width="20vw">
        {children ? (
          children
        ) : circle ? (
          <CircularProgress
            sx={{
              margin: "auto",
            }}
          />
        ) : (
          <LinearProgress />
        )}
      </Stack>
    </Stack>
  )
}

export default Loading
