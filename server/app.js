const express = require("express");
const cors = require("cors");
const { saveBoard } = require("./services/boardService");

const createApp = (pool) => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
    }),
  );

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");

      res.json({
        status: "success",
        message: "SyncSpace API and database are connected!",
      });
    } catch (error) {
      console.error("Database health check failed:", error);

      res.status(500).json({
        status: "error",
        message: "Database connection failed.",
      });
    }
  });

  // Save board to PostgreSQL

  // Save board to PostgreSQL using optimistic concurrency control
  app.post("/api/boards", async (req, res) => {
    const { nodes, edges, revision } = req.body;

    const result = await saveBoard(pool, { nodes, edges }, revision);

    if (!result.success) {
      return res.status(result.status).json({
        status: "error",
        message: result.message,
      });
    }

    res.json({
      status: "success",
      message: "Board saved successfully.",
      revision: result.revision,
    });
  });

  // Load board from PostgreSQL
  app.get("/api/boards", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT data, revision FROM boards WHERE id = 1",
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "No saved board found.",
        });
      }

      res.json({
        status: "success",
        board: result.rows[0].data,
        revision: result.rows[0].revision,
      });
    } catch (error) {
      console.error("Board load failed:", error);

      res.status(500).json({
        status: "error",
        message: "Could not load board.",
      });
    }
  });

  return app;
};

module.exports = createApp;
