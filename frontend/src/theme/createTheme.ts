import {
  blue,
  green,
  grey,
  pink,
  purple,
  red,
  yellow,
} from "@mui/material/colors"
import { createTheme } from "@mui/material/styles"
import { ColorRanges } from "contexts/types/setting"
import { Catamaran } from "next/font/google"

const gluten = Catamaran({
  weight: "600",
  subsets: ["latin"],
})

export default function createMuiTheme(
  mode: "light" | "dark",
  palette: ColorRanges
) {
  return createTheme({
    typography: {
      ...gluten.style,
      fontSize: 12,
    },
    palette: {
      primary: {
        main: blue[100],
      },
      info: {
        main: purple[300],
      },
      secondary: {
        main: pink[300],
      },
      error: {
        main: red[300],
      },
      warning: {
        main: mode === "dark" ? yellow[100] : yellow[900],
        light: mode === "dark" ? yellow[50] : yellow[800],
      },
      success: {
        main: green[300],
      },
      getContrastText: (background) => {
        const contrastText = background === grey[900] ? grey[100] : grey[900]
        return contrastText
      },
      text: {
        primary: mode === "dark" ? grey[100] : grey[900],
        secondary: mode === "dark" ? grey[200] : grey[600],
      },
      background: {
        default: mode === "dark" ? grey[900] : grey[300],
        paper: mode === "dark" ? grey[800] : "#fff",
        transparent: "rgb(245, 245, 245, 0.42)",
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
          maxWidthMd: {
            "@media (min-width: 900px)": {
              maxWidth: "700px",
            },
          },
          root: {
            padding: "8px 0",
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            borderStartEndRadius: "16px",
            borderStartStartRadius: "16px",
          },
          flexContainer: {
            borderBottom: "2px solid",
            borderColor: mode === "dark" ? grey[100] : grey[700],
            boxShadow: `inset 0px -3px 5px ${
              mode === "dark" ? grey[900] : grey[300]
            }`,
            backgroundColor: mode === "dark" ? grey[700] : grey[100],
            "& > button": {
              borderRight: "1px solid",
              borderColor: mode === "dark" ? grey[900] : grey[200],
            },
            "& > button:last-of-type not(.Mui-selected)": {
              border: "none",
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            overflow: "visible",
            "&.Mui-selected": {
              fontWeight: "bold",
              backgroundColor: mode === "dark" ? grey[800] : "#fff",
              boxShadow: "0px 2px 2px rgba(0, 0, 0, 0.25)",
              border: "2px solid",
              borderBottom: "none",
              borderColor: mode === "dark" ? grey[100] : grey[700],
              // add before element and give him a 2 px height
              "&::before": {
                content: '""',
                position: "absolute",
                bottom: "-2px",
                left: "0",
                width: "100%",
                height: "2px",
                backgroundColor: "white",
              },
            },
            "&:first-of-type": {
              borderStartStartRadius: "16px",
            },
            "&:last-of-type": {
              borderStartEndRadius: "16px",
            },
          },
        },
      },
      MuiCard: {
        variants: [
          {
            props: { variant: "outlined" },
            style: {
              border: "2px solid",
              borderRadius: "4px",
              borderColor: mode === "dark" ? grey[100] : grey[700],
            },
          },
          {
            props: { variant: "elevation" },
            style: {
              borderStartStartRadius: "0",
              borderStartEndRadius: "0",
            },
          },
          {
            props: { variant: "elevation", color: "primary" },
            style: {
              "& .section-body": {
                borderColor: mode === "dark" ? grey[100] : grey[700],
                backgroundColor: mode === "dark" ? blue[900] : blue[50],
              },
            },
          },
          {
            props: { variant: "elevation", color: "secondary" },
            style: {
              "& .section-body": {
                borderColor: mode === "dark" ? grey[100] : grey[700],
                backgroundColor: mode === "dark" ? pink[900] : pink[50],
              },
            },
          },
          {
            props: { variant: "elevation", color: "info" },
            style: {
              "& .section-body": {
                borderColor: mode === "dark" ? grey[100] : grey[700],
                backgroundColor: mode === "dark" ? purple[900] : purple[50],
              },
            },
          },
          {
            props: { variant: "elevation", color: "success" },
            style: {
              "& .section-body": {
                borderColor: mode === "dark" ? grey[100] : grey[700],
                backgroundColor: mode === "dark" ? green[900] : green[50],
              },
            },
          },
          {
            props: { variant: "outlined", color: "primary" },
            style: {
              borderColor: mode === "dark" ? grey[100] : grey[700],
              backgroundColor: mode === "dark" ? blue[900] : blue[50],
            },
          },
          {
            props: { variant: "outlined", color: "secondary" },
            style: {
              borderColor: mode === "dark" ? grey[100] : grey[700],
              backgroundColor: mode === "dark" ? pink[900] : pink[50],
            },
          },
          {
            props: { variant: "outlined", color: "info" },
            style: {
              borderColor: mode === "dark" ? grey[100] : grey[700],
              backgroundColor: mode === "dark" ? purple[900] : purple[50],
            },
          },
          {
            props: { variant: "outlined", color: "success" },
            style: {
              borderColor: mode === "dark" ? grey[100] : grey[700],
              backgroundColor: mode === "dark" ? green[900] : green[50],
            },
          },
        ],
      },
      MuiCardHeader: {
        styleOverrides: {
          title: {
            textTransform: "uppercase",
            fontWeight: "bold",
          },
          root: {
            paddingBottom: "0",
            textAlign: "center",
          },
        },
      },
      MuiAccordionSummary: {
        variants: [
          {
            props: { color: "primary" },
            style: {
              color: "black",
              backgroundColor: blue[300],
              "&:hover": {
                backgroundColor: blue[400],
              },
            },
          },
          {
            props: { color: "secondary" },
            style: {
              color: "black",
              backgroundColor: pink[300],
              "&:hover": {
                backgroundColor: pink[400],
              },
            },
          },
          {
            props: { color: "info" },
            style: {
              color: "black",
              backgroundColor: purple[300],
              "&:hover": {
                backgroundColor: purple[400],
              },
            },
          },
          {
            props: { color: "primary" },
            style: {
              color: blue[300],
              borderColor: blue[300],
              "&:hover": {
                backgroundColor: blue[50],
              },
            },
          },
          {
            props: { color: "secondary" },
            style: {
              color: pink[300],
              borderColor: pink[300],
              "&:hover": {
                backgroundColor: pink[50],
              },
            },
          },
        ],
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            borderWidth: "1px 2px",
            "&:first-of-type": {
              borderTop: "2px solid",
            },
            "&:last-of-type": {
              borderBottom: "2px solid",
            },
            "&.Mui-expanded": {
              margin: 0,
            },
          },
        },
        variants: [
          {
            props: { color: "primary" },
            style: {
              backgroundColor: blue[50],
            },
          },
          {
            props: { color: "secondary" },
            style: {
              backgroundColor: pink[50],
            },
          },
          {
            props: { color: "info" },
            style: {
              backgroundColor: purple[50],
            },
          },
        ],
        defaultProps: {
          color: "secondary",
          variant: "outlined",
          style: {
            fontWeight: "bold",
            fontSize: "0.8rem",
            borderColor: mode === "dark" ? grey[100] : grey[700],
          },
        },
      },
      MuiTextField: {
        variants: [
          {
            props: { variant: "outlined", color: "primary" },
            style: {
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: blue[300],
                },
                "&:hover fieldset": {
                  borderColor: blue[400],
                },
                "&.Mui-focused fieldset": {
                  borderColor: blue[500],
                },
              },
            },
          },
          {
            props: { variant: "outlined", color: "secondary" },
            style: {
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: pink[300],
                },
                "&:hover fieldset": {
                  borderColor: pink[400],
                },
                "&.Mui-focused fieldset": {
                  borderColor: pink[500],
                },
              },
            },
          },
          {
            props: { variant: "outlined", color: "info" },
            style: {
              "& .MuiInputLabel-root.Mui-focused": {
                color: purple[300],
              },
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: purple[300],
                },
                "&:hover fieldset": {
                  borderColor: purple[400],
                },
                "&.Mui-focused fieldset": {
                  borderColor: purple[500],
                },
              },
            },
          },
        ],
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              "& fieldset": {
                borderWidth: "2px",
                borderColor: mode === "dark" ? grey[100] : grey[700],
              },
            },
          },
        },
        defaultProps: {
          variant: "outlined",
          size: "small",
          fullWidth: true,
        },
      },
      MuiIconButton: {
        variants: [
          {
            props: { size: "small", color: "inherit" },
            style: {
              fontSize: 14,
              padding: 0,
              marginLeft: 0.5,
              backgroundColor: "transparent",
              border: "none",
            },
          },
          {
            props: { color: "primary" },
            style: {
              color: blue[300],
              "&:hover": {
                backgroundColor: blue[50],
              },
            },
          },
          {
            props: { color: "secondary" },
            style: {
              color: pink[900],
              "&:hover": {
                backgroundColor: pink[50],
              },
            },
          },
          {
            props: { color: "info" },
            style: {
              color: purple[300],
              "&:hover": {
                backgroundColor: purple[50],
              },
            },
          },
        ],
        styleOverrides: {
          root: {
            borderRadius: "4px",
            backgroundColor: mode === "dark" ? grey[800] : grey[200],
            border: "2px solid",
            padding: "4px",
            "&:hover": {
              backgroundColor: mode === "dark" ? grey[700] : grey[300],
              borderRadius: "4px",
            },
          },
        },
      },
      MuiAlert: {
        variants: [
          {
            props: { severity: "success" },
            style: {
              backgroundColor: green[50],
              color: green[300],
              "& .MuiAlert-icon": {
                color: green[300],
              },
            },
          },
          {
            props: { severity: "info" },
            style: {
              backgroundColor: purple[50],
              color: purple[300],
              "& .MuiAlert-icon": {
                color: purple[300],
              },
            },
          },
          {
            props: { severity: "warning" },
            style: {
              backgroundColor: yellow[50],
              color: yellow[300],
              "& .MuiAlert-icon": {
                color: yellow[300],
              },
            },
          },
          {
            props: { severity: "error" },
            style: {
              backgroundColor: red[50],
              color: red[300],
              "& .MuiAlert-icon": {
                color: red[300],
              },
            },
          },
        ],
        styleOverrides: {
          root: {
            borderRadius: "4px",
            border: "2px solid",
            borderColor: mode === "dark" ? grey[100] : grey[700],
            "& .MuiAlert-message": {
              fontWeight: "bold",
              padding: "10px 0 0 0",
            },
          },
        },
      },
      MuiPaper: {
        variants: [
          {
            props: { color: "primary", variant: "outlined" },
            style: {
              backgroundColor: mode === "dark" ? blue[900] : blue[50],
            },
          },
          {
            props: { color: "secondary", variant: "outlined" },
            style: {
              backgroundColor: mode === "dark" ? pink[900] : pink[50],
            },
          },
          {
            props: { color: "info", variant: "outlined" },
            style: {
              backgroundColor: mode === "dark" ? purple[900] : purple[50],
            },
          },
          {
            props: { color: "success", variant: "outlined" },
            style: {
              backgroundColor: mode === "dark" ? green[900] : green[50],
            },
          },
        ],
        styleOverrides: {
          root: {
            borderRadius: "4px",
            border: "2px solid",
            borderColor: mode === "dark" ? grey[100] : grey[700],
          },
        },
      },
      MuiButton: {
        variants: [
          {
            props: { variant: "contained", color: "primary" },
            style: {
              color: "black",
              backgroundColor: blue[300],
              "&:hover": {
                backgroundColor: blue[400],
              },
            },
          },
          {
            props: { variant: "contained", color: "secondary" },
            style: {
              color: "black",
              backgroundColor: pink[300],
              "&:hover": {
                backgroundColor: pink[400],
              },
            },
          },
          {
            props: { variant: "contained", color: "info" },
            style: {
              color: "black",
              backgroundColor: purple[300],
              "&:hover": {
                backgroundColor: purple[400],
              },
            },
          },
          {
            props: { variant: "outlined", color: "primary" },
            style: {
              color: blue[300],
              borderColor: blue[300],
              "&:hover": {
                backgroundColor: blue[50],
              },
            },
          },
          {
            props: { variant: "outlined", color: "secondary" },
            style: {
              color: pink[300],
              borderColor: pink[300],
              "&:hover": {
                backgroundColor: pink[50],
              },
            },
          },
        ],
        defaultProps: {
          variant: "contained",
          fullWidth: true,
          style: {
            fontWeight: "bold",
            fontSize: "0.8rem",
            border: "2px solid",
            borderColor: mode === "dark" ? grey[100] : grey[700],
          },
        },
      },
    },
  })
}
