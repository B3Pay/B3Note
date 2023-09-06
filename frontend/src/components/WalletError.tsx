import { Alert, AlertProps, AlertTitle } from "@mui/material"
import { compileError } from "helper/utils"
import { useMemo } from "react"

interface WalletErrorProps extends AlertProps {
  error: string
}

const WalletError: React.FC<WalletErrorProps> = ({ error, ...rest }) => {
  const { title, description } = useMemo(() => {
    const errors = error
      ? error.toString().includes("Error::")
        ? error.toString().split("Error::")
        : [error.toString()]
      : ["Unknown error"]

    return compileError(errors)
  }, [error])

  return (
    <Alert title="error" {...rest}>
      <AlertTitle>{title}</AlertTitle>
      {description}
    </Alert>
  )
}

export default WalletError
