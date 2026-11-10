
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  override: true,
});

const pool = require("./config/db");
const createApp = require("./app");

const PORT = process.env.PORT || 5000;

const app = createApp(pool);

// Start server
app.listen(PORT, () => {
  console.log(`SyncSpace API running on port ${PORT}`);
});
