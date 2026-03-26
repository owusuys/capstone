import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root (one level up from server/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "vtcs",
  user: process.env.DB_USER ?? "vtcs",
  password: process.env.DB_PASSWORD ?? "",
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
