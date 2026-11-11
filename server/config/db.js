
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5433,
  database: process.env.POSTGRES_DB,
});

module.exports = pool;
