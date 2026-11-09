import { useEffect, useState } from "react";
import Board from "./features/board/Board";
import { apiRequest } from "./lib/api";

function App() {
  const [apiStatus, setApiStatus] = useState("Checking backend...");

  useEffect(() => {
    apiRequest("/api/health")
      .then((data) => {
        setApiStatus(data.message);
      })
      .catch(() => {
        setApiStatus("Backend connection failed");
      });
  }, []);

  return (
    <main>
      <h1>SyncSpace</h1>
      <p>A collaborative visual workspace</p>

      <p>Backend status: {apiStatus}</p>

      <Board />
    </main>
  );
}

export default App;
