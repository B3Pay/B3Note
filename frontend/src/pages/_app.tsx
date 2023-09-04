import AppContainer from "components/Container"
import { LocalStorageLoader } from "contexts/loaders"
import store from "contexts/store"
import type { AppProps } from "next/app"
import { Provider } from "react-redux"
import ThemeProvider from "theme"
import "theme/global.css"

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
