import {
  Card,
  CardHeader,
  CardProps,
  IconButton,
  IconButtonProps,
  Stack,
  Typography,
} from "@mui/material"
import { RefreshIcon } from "./Icons"
import Loading from "./Loading"

interface SectionProps extends CardProps {
  title?: string
  description?: React.ReactNode
  noShadow?: boolean
  noMargin?: boolean
  loading?: boolean
  loadingTitle?: string | null
  action?: () => void
  actionIcon?: React.ReactNode
  actionProps?: IconButtonProps
}

const Section: React.FC<SectionProps> = ({
  children,
  title,
  description,
  action,
  actionIcon,
  noShadow,
  noMargin,
  loading,
  actionProps,
  loadingTitle,
  ...rest
}) => {
  return (
    <Card
      variant={noShadow ? "outlined" : "elevation"}
      elevation={!noShadow && title ? 2 : 0}
      {...rest}
      style={{
        borderTop: !noShadow ? "none" : undefined,
      }}
    >
      {title &&
        (noShadow ? (
          <CardHeader
            title={
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                justifyContent="space-between"
              >
                {title}
                {action && (
                  <IconButton onClick={action} size="small" {...actionProps}>
                    {actionIcon || <RefreshIcon />}
                  </IconButton>
                )}
              </Stack>
            }
            titleTypographyProps={{
              variant: noShadow ? "subtitle1" : "h6",
            }}
            sx={{
              textAlign: noShadow ? "left" : "center",
            }}
            subheader={description}
          />
        ) : (
          <Typography variant="h5" textAlign="center" paddingTop={2}>
            {title}
          </Typography>
        ))}
      <Stack
        p={1}
        m={noMargin ? 0 : 1}
        spacing={1}
        border="1px solid"
        borderColor={!noShadow ? "grey.400" : "transparent"}
        borderRadius={1}
        position="relative"
        className="section-body"
      >
        {loading && <Loading circle title={loadingTitle} />}
        {children}
      </Stack>
    </Card>
  )
}

export default Section
