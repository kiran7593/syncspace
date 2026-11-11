import { useEffect, useState } from "react";
import Board from "./features/board/Board";
import { apiRequest } from "./lib/api";
import { socket } from "./lib/socket";

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

  useEffect(() => {
    const handleConnect = () => {
      console.log("Connected to SyncSpace real-time server:", socket.id);

      socket.emit("join-room", "default-board");
    };

    const handleDisconnect = () => {
      console.log("Disconnected from SyncSpace real-time server");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.disconnect();
    };
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
