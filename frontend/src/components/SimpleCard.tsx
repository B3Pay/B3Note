import Box, { BoxProps } from "@mui/material/Box"

interface SimpleCardProps extends BoxProps {}

const SimpleCard: React.FC<SimpleCardProps> = ({ children, ...rest }) => {
  return (
    <Box
      paddingX={2}
      paddingTop={1.2}
      paddingBottom={1}
      borderRadius={1}
      border="2px solid"
      borderColor="background.secondary"
      bgcolor="background.default"
      color="text.secondary"
      fontSize="0.8rem"
      {...rest}
    >
      {children}&nbsp;
    </Box>
  )
}

export default SimpleCard
