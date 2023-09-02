import { Link } from "@mui/material"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Grid from "@mui/material/Grid"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import { keyframes } from "@mui/system"

const SpinY = keyframes`
  0% {
    transform: rotateY(0deg);
  }
  25% {
    transform: rotateY(0deg);
  }
  50% {
    transform: rotateY(180deg);
  }
  75% {
    transform: rotateY(360deg);
  }
  100% {
    transform: rotateY(360deg);
  }
`

interface FooterProps {}

const Footer: React.FC<FooterProps> = ({}) => {
  return (
    <Grid
      container
      direction="row"
      spacing={0.5}
      marginTop={0}
      marginBottom={2}
    >
      <Grid item minHeight="50px">
        <Link
          href="https://internetcomputer.org/"
          component="a"
          underline="none"
          target="_blank"
          rel="noopener"
        >
          <Card
            sx={{
              alignItems: "center",
              textAlign: "center",
              display: "flex",
              height: "100%",
              px: 1,
            }}
          >
            <Stack spacing={0.5}>
              <Box
                component="img"
                src="/icp.svg"
                alt="icp-logo"
                height={20}
                sx={{
                  animation: `${SpinY} 5s ease-in-out infinite`,
                }}
              />
              <Box whiteSpace="nowrap" fontFamily="Monospace" fontSize={8}>
                100% on-chain
              </Box>
            </Stack>
          </Card>
        </Link>
      </Grid>
      <Grid item xs minHeight="50px">
        <Card
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            height: "30px",
            color: "text.secondary",
            p: 1,
          }}
        >
          <Typography variant="caption">
            End-to-end encrypted using{" "}
            <a href="https://internetcomputer.org/docs/current/developer-docs/integrations/vetkeys/">
              vetkd
            </a>
            . The source code is available on{" "}
            <a href="https://github.com/B3Pay/vetkd_examples">GitHub</a>.
          </Typography>
        </Card>
      </Grid>
    </Grid>
  )
}

export default Footer
