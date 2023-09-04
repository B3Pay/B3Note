import {
  Card,
  CardHeader,
  CardProps,
  IconButton,
  Stack,
  Typography,
} from "@mui/material"
import { RefreshIcon } from "./Icons"
import Loading from "./Loading"

interface SectionProps extends CardProps {
  title?: string
  description?: string
  noShadow?: boolean
  loading?: boolean
  loadingTitle?: string
  action?: () => void
  actionIcon?: React.ReactNode
}

const Section: React.FC<SectionProps> = ({
  children,
  title,
  description,
  action,
  actionIcon,
  noShadow,
  loading,
  loadingTitle,
  ...rest
}) => {
  return (
    <Card
      variant={noShadow ? "outlined" : "elevation"}
      elevation={!noShadow && title ? 2 : 0}
      {...rest}
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
                  <IconButton onClick={action} size="small">
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
        m={1}
        spacing={2}
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
