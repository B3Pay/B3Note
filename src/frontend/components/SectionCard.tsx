import { Box, Card, CardHeader, CardProps } from "@mui/material"
import { forwardRef } from "react"

interface SectionCardProps extends Omit<CardProps, "mb"> {
  title?: string
  description?: string
}

const SectionCard: React.FC<SectionCardProps> = forwardRef(
  ({ children, title, description, ...props }, ref) => {
    return (
      <Box mb={1}>
        <Card ref={ref} {...props}>
          {title && (
            <CardHeader
              title={title}
              subheader={description}
              titleTypographyProps={{
                variant: "h6",
                textTransform: "uppercase",
                fontWeight: "bold",
              }}
            />
          )}
          <Box
            p={1}
            m={1}
            border="1px solid"
            borderColor="primary.100"
            borderRadius={1}
          >
            {children}
          </Box>
        </Card>
      </Box>
    )
  }
)

export default SectionCard
