import WebcamCapture from './WebcamCapture.tsx';
import "./App.css";

function App() {

    return (
    <div className="App">
      <h3 className="text-xl font-bold mb-4">Scan & Capture</h3>
      {<WebcamCapture />}
    </div>
  );
}

export default App;
