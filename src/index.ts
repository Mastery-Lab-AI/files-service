import express from "express";
import "dotenv/config";

import { createFile } from "./controllers/filesController";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/", (_req, res) => {
  res.send("Files Service - running");
});
app.post("/workspace/:workspaceId/files", createFile);

export default app;

app.listen(PORT, () => {
  console.log(`Files Service listening on port ${PORT}`);
});
