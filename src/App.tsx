import WebcamCapture from './WebcamCapture.tsx';
import "./App.css";

function App() {

    return (
    <div className="App">
      <h1 className="text-xl font-bold mb-4">Scan & Capture</h1>
      {<WebcamCapture />}
    </div>
  );
}

export default App;
