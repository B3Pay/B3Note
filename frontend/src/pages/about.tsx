import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import Section from "components/Section"
import {
  useBackendIsInitialized,
  useBackendLogs,
} from "contexts/hooks/useBackend"
import Link from "next/link"

interface AboutProps {}

const About: React.FC<AboutProps> = ({}) => {
  const logs = useBackendLogs()
  const backendInitailized = useBackendIsInitialized()

  // useEffect(() => {
  //   fetchLogs()
  // }, [])

  return (
    <Section
      title="About"
      color="success"
      loading={!backendInitailized}
      loadingTitle="Initializing"
    >
      <Typography variant="body1">
        This is a simple demo of the Vetkd library. It uses the{" "}
        <Link href="https://sdk.dfinity.org/docs/interface-spec/index.html">
          Internet Identity
        </Link>{" "}
        to authenticate users, and then uses Vetkd to encrypt and decrypt
        messages.
      </Typography>
      <Typography variant="body1">
        The demo is a simple note-taking app. You can create About, and then
        share them with other users. You can also view About that have been
        shared with you.
      </Typography>
      <Typography variant="body1">
        The demo is built with Rust and TypeScript. The source code is available
        on <Link href="https://github.com/B3Pay/vetkd_examples">GitHub</Link>.
      </Typography>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Dessert (100g serving)</TableCell>
              <TableCell align="right">Calories</TableCell>
              <TableCell align="right">Fat&nbsp;(g)</TableCell>
              <TableCell align="right">Carbs&nbsp;(g)</TableCell>
              <TableCell align="right">Protein&nbsp;(g)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((row, index) => (
              <TableRow
                key={index}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row}
                </TableCell>
                {/* <TableCell align="right">{row.calories}</TableCell>
          <TableCell align="right">{row.fat}</TableCell>
          <TableCell align="right">{row.carbs}</TableCell>
          <TableCell align="right">{row.protein}</TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Section>
  )
}

export default About
