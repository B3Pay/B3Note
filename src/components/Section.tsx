import {
  Card,
  CardHeader,
  CardProps,
  IconButton,
  Stack,
  Typography,
  createSvgIcon,
} from "@mui/material"
import { forwardRef } from "react"

interface SectionProps extends CardProps {
  title?: string
  description?: string
  noShadow?: boolean
  action?: () => void
  actionIcon?: React.ReactNode
}

const Section: React.FC<SectionProps> = forwardRef((props, ref) => {
  const {
    children,
    title,
    description,
    action,
    actionIcon,
    noShadow,
    ...rest
  } = props

  return (
    <Card
      ref={ref}
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
      >
        {children}
      </Stack>
    </Card>
  )
})

export default Section

const RefreshIcon = createSvgIcon(
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 4335 4335"
  >
    <path d="M1894 471l0 0 50 0c137,0 249,112 249,249l0 0c0,137 -112,249 -249,249l-116 0 0 -1c-667,35 -1196,586 -1196,1261 0,697 565,1263 1263,1263 664,0 1209,-513 1259,-1164l-417 0 -33 0c0,0 -210,-87 -37,-310 173,-223 557,-780 557,-780 0,0 89,-153 196,-139 107,-14 196,139 196,139 0,0 384,557 557,780 173,223 -37,310 -37,310l-33 0 -452 0c-51,925 -818,1659 -1755,1659 -971,0 -1758,-787 -1758,-1758 0,-949 751,-1722 1692,-1757l0 -1 67 0z" />
  </svg>,
  "RefreshIcon"
)
