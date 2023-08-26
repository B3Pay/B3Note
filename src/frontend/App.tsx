import Identity from "./Identity"

interface AppProps {}

const App: React.FC<AppProps> = ({}) => {
  return (
    <div>
      <Identity />
      <h1>Bare React</h1>
    </div>
  )
}

export default App
