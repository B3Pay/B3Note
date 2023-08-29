import { Route, Routes } from "react-router-dom"
import About from "./components/About"
import Home from "./components/Home"
import Layout from "./components/Layout"
import NoMatch from "./components/NoMatch"
import WithIdentity from "./components/WithII"
import WithoutIdentity from "./components/WithoutII"

interface AppProps {}

const App: React.FC<AppProps> = ({}) => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/withoutii" element={<WithoutIdentity />} />
        <Route path="/withii" element={<WithIdentity />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NoMatch />} />
      </Route>
    </Routes>
  )
}

export default App
