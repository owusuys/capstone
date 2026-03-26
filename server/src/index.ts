import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import courseRouter from "./routes/courses";
import prereqRouter from "./routes/prereqs";
import coreqRouter from "./routes/coreqs";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.use("/api/courses", courseRouter);
app.use("/api", prereqRouter);
app.use("/api/corequisites", coreqRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`VTCS API server running on http://localhost:${PORT}`);
});
