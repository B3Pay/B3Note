import AppContainer from "components/Container"
import { LocalStorageLoader } from "contexts/loaders"
import store from "contexts/store"
import type { AppProps } from "next/app"
import { Provider } from "react-redux"
import "theme/global.css"
import ThemeProvider from "../theme"

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <LocalStorageLoader />
        <AppContainer>
          <Component {...pageProps} />
        </AppContainer>
      </ThemeProvider>
    </Provider>
  )
}

export default App
