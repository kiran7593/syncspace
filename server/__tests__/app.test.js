
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const createApp = require("../app");

test("GET /api/health returns success when the database is connected", async () => {
  const mockPool = {
    query: async () => ({ rows: [{ result: 1 }] }),
  };

  const app = createApp(mockPool);

  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.equal(
    response.body.message,
    "SyncSpace API and database are connected!",
  );
});


test("GET /api/health returns 500 when the database connection fails", async () => {
  const mockPool = {
    query: async () => {
      throw new Error("Database unavailable");
    },
  };

  const app = createApp(mockPool);

  const response = await request(app).get("/api/health");

  assert.equal(response.status, 500);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Database connection failed.");
});

test("POST /api/boards saves valid board data", async () => {
  let savedQuery;
  let savedValues;

  const mockPool = {
    query: async (query, values) => {
      savedQuery = query;
      savedValues = values;

      return { rows: [] };
    },
  };

  const app = createApp(mockPool);

  const board = {
    nodes: [
      {
        id: "1",
        position: { x: 100, y: 100 },
        data: { label: "Test Node" },
      },
    ],
    edges: [],
  };

  const response = await request(app)
    .post("/api/boards")
    .send(board);

  assert.equal(response.status, 201);
  assert.equal(response.body.status, "success");
  assert.equal(
    response.body.message,
    "Board saved successfully.",
  );

  assert.match(savedQuery, /INSERT INTO boards/);
  assert.deepEqual(savedValues[0], board);
});

test("POST /api/boards rejects invalid board data", async () => {
  const mockPool = {
    query: async () => {
      throw new Error("Database should not be called");
    },
  };

  const app = createApp(mockPool);

  const response = await request(app)
    .post("/api/boards")
    .send({
      nodes: "not-an-array",
      edges: [],
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Invalid board data.");
});

test("GET /api/boards returns the saved board", async () => {
  const board = {
    nodes: [
      {
        id: "1",
        position: { x: 100, y: 100 },
        data: { label: "Saved Node" },
      },
    ],
    edges: [],
  };

  const mockPool = {
    query: async () => ({
      rows: [{ data: board }],
    }),
  };

  const app = createApp(mockPool);

  const response = await request(app).get("/api/boards");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.deepEqual(response.body.board, board);
});

test("GET /api/boards returns 404 when no saved board exists", async () => {
  const mockPool = {
    query: async () => ({
      rows: [],
    }),
  };

  const app = createApp(mockPool);

  const response = await request(app).get("/api/boards");

  assert.equal(response.status, 404);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "No saved board found.");
});

test("GET /api/boards returns 500 when the database query fails", async () => {
  const mockPool = {
    query: async () => {
      throw new Error("Database unavailable");
    },
  };

  const app = createApp(mockPool);

  const response = await request(app).get("/api/boards");

  assert.equal(response.status, 500);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Could not load board.");
});

test("POST /api/boards returns 500 when the database query fails", async () => {
  const mockPool = {
    query: async () => {
      throw new Error("Database unavailable");
    },
  };

  const app = createApp(mockPool);

  const response = await request(app)
    .post("/api/boards")
    .send({
      nodes: [],
      edges: [],
    });

  assert.equal(response.status, 500);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Could not save board.");
});
