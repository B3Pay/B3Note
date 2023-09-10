import { Button, Stack, Typography } from "@mui/material"
import { requestOneTimeKey } from "contexts/helpers"
import { useAuthCode } from "contexts/hooks/useBackend"

interface TwoFactorProps {}

const TwoFactor: React.FC<TwoFactorProps> = ({}) => {
  const { code, signature } = useAuthCode()

  return code ? (
    <Stack spacing={2}>
      <Typography variant="h5" component="div">
        {code}
      </Typography>
      <Typography variant="h5" component="div">
        {signature}
      </Typography>
    </Stack>
  ) : (
    <Button onClick={requestOneTimeKey} variant="contained">
      Request Auth Code
    </Button>
  )
}

export default TwoFactor
