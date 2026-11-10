
const express = require("express");
const cors = require("cors");

const createApp = (pool) => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: "http://localhost:5173",
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
  app.post("/api/boards", async (req, res) => {
    const { nodes, edges } = req.body;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid board data.",
      });
    }

    try {
      await pool.query(
        `INSERT INTO boards (id, data)
         VALUES (1, $1)
         ON CONFLICT (id)
         DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = NOW()`,
        [{ nodes, edges }],
      );

      res.status(201).json({
        status: "success",
        message: "Board saved successfully.",
      });
    } catch (error) {
      console.error("Board save failed:", error);

      res.status(500).json({
        status: "error",
        message: "Could not save board.",
      });
    }
  });

  // Load board from PostgreSQL
  app.get("/api/boards", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT data FROM boards WHERE id = 1",
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
