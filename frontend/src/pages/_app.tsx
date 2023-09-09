import { LocalStorageLoader } from "contexts/loaders"
import store from "contexts/store"
import type { AppProps } from "next/app"
import dynamic from "next/dynamic"
import { Provider } from "react-redux"
import ThemeProvider from "theme"
import "theme/global.css"

// Fixes: Hydration failed because the initial UI does not match what was rendered on the server.
const DynamicAppContainer = dynamic(
  () => import("components/Container").then((mod) => mod.default),
  {
    ssr: false,
  }
)

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <LocalStorageLoader />
        <DynamicAppContainer>
          <Component {...pageProps} />
        </DynamicAppContainer>
      </ThemeProvider>
    </Provider>
  )
}

export default App
