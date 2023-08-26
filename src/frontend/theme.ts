import { pink, purple, red } from "@mui/material/colors"
import { createTheme } from "@mui/material/styles"

// A custom theme for this app
const theme = createTheme({
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(","),
    fontSize: 12,
  },
  palette: {
    primary: {
      main: pink[300],
      light: pink[200],
      dark: pink[700],
      "100": pink[100],
      "200": pink[200],
      "300": pink[300],
      "400": pink[400],
      "500": pink[500],
      "600": pink[600],
      "700": pink[700],
      "800": pink[800],
      "900": pink[900],
    },
    secondary: {
      main: purple[300],
    },
    error: {
      main: red.A400,
    },
    background: {
      // pink grey
      default: pink[50],
      paper: "#fff",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        body: {
          backgroundColor: theme.palette.background.default,
        },
      }),
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          padding: "8px 0",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderStartStartRadius: "16px",
          borderStartEndRadius: "16px",
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: "8px 16px",
          borderBottom: "1px solid",
          borderColor: pink[200],
          textAlign: "center",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        variant: "outlined",
        fullWidth: true,
        style: {
          fontWeight: "bold",
          fontSize: "0.8rem",
          border: "1.5px solid",
        },
      },
    },
  },
})

export default theme
