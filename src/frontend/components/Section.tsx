import { Card, CardHeader, CardProps, Stack } from "@mui/material"
import { forwardRef } from "react"

interface SectionProps extends CardProps {
  title?: string
  description?: string
  noFrame?: boolean
}

const Section: React.FC<SectionProps> = forwardRef(
  ({ children, title, description, noFrame, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        sx={
          !noFrame
            ? {
                borderStartStartRadius: "0",
                borderStartEndRadius: "0",
              }
            : {}
        }
        elevation={!noFrame && title ? 2 : 0}
        {...props}
      >
        {title && (
          <CardHeader
            title={title}
            titleTypographyProps={{
              variant: noFrame ? "subtitle1" : "h6",
            }}
            sx={{
              textAlign: noFrame ? "left" : "center",
            }}
            subheader={description}
          />
        )}
        <Stack
          p={1}
          m={1}
          spacing={2}
          border="1px solid"
          borderColor={!noFrame ? "grey.400" : "transparent"}
          borderRadius={1}
        >
          {children}
        </Stack>
      </Card>
    )
  }
)

export default Section
