import './App.css'
import MapComponent from './components/map';


function App() {

  return (
    <div
      style={{
        height: '100vh',
        width: '85 vw',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <div>
        <MapComponent></MapComponent>
      </div>
    </div>

  )
}

export default App
