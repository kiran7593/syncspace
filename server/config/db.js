const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: "localhost",
  port: 5433,
  database: process.env.POSTGRES_DB,
});

module.exports = pool;
