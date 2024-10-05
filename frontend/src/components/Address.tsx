import { CheckOutlined } from "@mui/icons-material"
import {
  BoxProps,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material"
import { useMemo } from "react"
//@ts-ignore
import useClipboard from "react-use-clipboard"
import { CopyIcon } from "./Icons"
import SimpleCard from "./SimpleCard"

interface AddressWithCopyProps extends BoxProps {
  address: string
  iconColor?:
    | "inherit"
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning"
  noIcon?: boolean
  hiddenAddress?: boolean
}

const Address: React.FC<AddressWithCopyProps> = ({
  address,
  noIcon,
  overflow,
  children,
  iconColor,
  prefix,
  hiddenAddress,
  ...rest
}) => {
  const [hasCopied, onCopy] = useClipboard(address, {
    successDuration: 2000,
  })
  const isLargerThan500 = useMediaQuery("(min-width: 568px)")

  const truncatedAddress = useMemo(() => {
    if (
      overflow ||
      address.length <= 20 ||
      (isLargerThan500 && address.length <= 42)
    ) {
      return address
    }

    const Start = address.slice(0, isLargerThan500 ? 20 : 8)
    const End = address.slice(isLargerThan500 ? -20 : -8)

    return `${Start}...${End}`
  }, [address, overflow, isLargerThan500])

  return (
    <SimpleCard {...rest}>
      {prefix ?? children}&nbsp;
      <Tooltip title={address} placement="top" aria-label="Full address">
        <Stack
          display="inline-flex"
          direction="row"
          alignItems="center"
          bgcolor="background.transparent"
          paddingX={0.5}
          borderRadius={1}
          spacing={0.2}
        >
          <Typography
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            fontWeight="bold"
            color="text.primary"
            hidden={hiddenAddress}
          >
            {truncatedAddress}
          </Typography>
          {noIcon ? null : (
            <IconButton
              onClick={onCopy}
              aria-label="Copy address"
              size="small"
              color={iconColor ?? "inherit"}
              sx={{
                border: iconColor ? "none" : undefined,
              }}
            >
              {hasCopied ? (
                <CheckOutlined fontSize="inherit" />
              ) : (
                <CopyIcon fontSize="inherit" />
              )}
            </IconButton>
          )}
        </Stack>
      </Tooltip>
      &nbsp;{prefix && children}
    </SimpleCard>
  )
}

export default Address
