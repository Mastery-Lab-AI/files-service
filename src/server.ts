import express from "express";
import "dotenv/config";
import cors, { CorsOptions } from "cors";

import {errorHandler} from "./errorHandler";
import healthRouter from "./routers/healthRouter";
import fileRouter from "./routers/fileRouter";
import workspaceRouter from "./routers/workspaceRouter";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// CORS — allow frontend dev origin and authorization header
const devOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests without origin (e.g., curl) or from devOrigins
    if (!origin || devOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/health", healthRouter)
app.use("/workspace", workspaceRouter)
app.use("/files", fileRouter)

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Files Service listening on port ${PORT}`);
  });
}

export default app;
