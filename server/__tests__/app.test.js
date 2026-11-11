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

test("POST /api/boards saves valid board data and increments revision", async () => {
  let savedQuery;
  let savedValues;

  const mockPool = {
    query: async (query, values) => {
      savedQuery = query;
      savedValues = values;

      return { rows: [{ revision: 2 }] };
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
    .send({ ...board, revision: 1 });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.equal(response.body.revision, 2);

  assert.match(savedQuery, /UPDATE boards/);
  assert.match(savedQuery, /revision = revision \+ 1/);
  assert.deepEqual(savedValues[0], board);
  assert.equal(savedValues[1], 1);
});

test("POST /api/boards rejects an outdated revision", async () => {
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

  const response = await request(app).post("/api/boards").send({
    nodes: [],
    edges: [],
    revision: 1,
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Board has changed. Please reload.");
  assert.equal(response.body.revision, undefined);

  assert.match(savedQuery, /UPDATE boards/);
  assert.equal(savedValues[1], 1);
});

test("POST /api/boards rejects invalid board data", async () => {
  const mockPool = {
    query: async () => {
      throw new Error("Database should not be called");
    },
  };

  const app = createApp(mockPool);

  const response = await request(app).post("/api/boards").send({
    nodes: "not-an-array",
    edges: [],
    revision: 1,
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Invalid board data or revision.");
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
      rows: [{ data: board, revision: 3 }],
    }),
  };

  const app = createApp(mockPool);

  const response = await request(app).get("/api/boards");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.deepEqual(response.body.board, board);
  assert.equal(response.body.revision, 3);
  assert.equal(response.body.revision, 3);});

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

  const response = await request(app).post("/api/boards").send({
    nodes: [],
    edges: [],
    revision: 1,
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Could not save board.");
});
