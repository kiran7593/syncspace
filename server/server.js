const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { saveBoard } = require("./services/boardService");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  override: true,
});

const pool = require("./config/db");
const createApp = require("./app");

const PORT = process.env.PORT || 5000;

const app = createApp(pool);

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Listen for Socket.IO connections
io.on("connection", (socket) => {
  let currentRoom = null;

  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    if (typeof roomId !== "string" || !roomId.trim()) {
      return;
    }

    if (currentRoom) {
      socket.leave(currentRoom);
    }

    socket.join(roomId);
    currentRoom = roomId;

    console.log(`Client ${socket.id} joined room: ${roomId}`);
  });

  socket.on("board-update", async (board, acknowledge) => {
    if (!currentRoom) {
      return;
    }

    if (
      !board ||
      !Array.isArray(board.nodes) ||
      !Array.isArray(board.edges) ||
      !Number.isInteger(board.revision)
    ) {
      return;
    }

    try {
      const result = await saveBoard(
        pool,
        {
          nodes: board.nodes,
          edges: board.edges,
        },
        board.revision,
      );

      if (!result.success) {
        if (result.status === 409) {
          const latestResult = await pool.query(
            "SELECT data, revision FROM boards WHERE id = 1",
          );

          const latestBoard = latestResult.rows[0];

          socket.emit("board-save-error", {
            status: 409,
            message: result.message,
            board: latestBoard?.data,
            revision: latestBoard?.revision,
          });

          if (typeof acknowledge === "function") {
            acknowledge({
              success: false,
              status: 409,
              message: result.message,
              board: latestBoard?.data,
              revision: latestBoard?.revision,
            });
          }

          return;
        }

        socket.emit("board-save-error", {
          status: result.status,
          message: result.message,
        });

        if (typeof acknowledge === "function") {
          acknowledge({
            success: false,
            status: result.status,
            message: result.message,
          });
        }

        return;
      }

      const savedBoard = {
        nodes: board.nodes,
        edges: board.edges,
        revision: result.revision,
      };

      socket.emit("board-saved", {
        revision: result.revision,
      });

      if (typeof acknowledge === "function") {
        acknowledge({
          success: true,
          revision: result.revision,
        });
      }

      socket.to(currentRoom).emit("board-update", savedBoard);
    } catch (error) {
      console.error("Socket board update failed:", error);

      socket.emit("board-save-error", {
        status: 500,
        message: "Could not save board.",
      });

      if (typeof acknowledge === "function") {
        acknowledge({
          success: false,
          status: 500,
          message: "Could not save board.",
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});


// Start the HTTP and Socket.IO server
server.listen(PORT, () => {
  console.log(`SyncSpace API running on port ${PORT}`);
});

// Gracefully close connections when the server shuts down

let isShuttingDown = false;

const shutdown = () => {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log("Shutting down SyncSpace API...");

  io.close(async () => {
    try {
      await pool.end();
      console.log("Database connections closed.");
      process.exit(0);
    } catch (error) {
      console.error("Error closing database connections:", error);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
