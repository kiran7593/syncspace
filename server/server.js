const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
let savedBoard = null;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "SyncSpace API is running!",
  });
});

// Save board
app.post("/api/boards", (req, res) => {
  const { nodes, edges } = req.body;

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid board data.",
    });
  }

  savedBoard = { nodes, edges };

  res.status(201).json({
    status: "success",
    message: "Board saved successfully.",
  });
});

// Load board
app.get("/api/boards", (req, res) => {
  if (!savedBoard) {
    return res.status(404).json({
      status: "error",
      message: "No saved board found.",
    });
  }

  res.json({
    status: "success",
    board: savedBoard,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`SyncSpace API running on port ${PORT}`);
});