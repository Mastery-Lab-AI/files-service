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
  try {
    console.log(`[FILES] Supabase URL: ${process.env.SUPABASE_URL || 'unset'}`);
  } catch {}
  app.listen(PORT, () => {
    console.log(`Files Service listening on port ${PORT}`);
  });
}

export default app;
import express from "express";
import "dotenv/config";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";

import { errorHandler } from "./errorHandler";
import healthRouter from "./routers/healthRouter";
import fileRouter from "./routers/fileRouter";
import workspaceRouter from "./routers/workspaceRouter";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// Security headers
app.use(helmet());

// CORS configuration using env, fallback to common dev origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]).map((s) => s.trim()).filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return cb(null, true); // allow curl/no-origin
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
};
app.use(cors(corsOptions));

// CORS error -> JSON
app.use((err: any, _req: any, res: any, next: any) => {
  if (err && typeof err.message === "string" && err.message.includes("CORS")) {
    return res.status(403).json({ error: "CORS policy violation" });
  }
  next(err);
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Route prefixes via env (defaults preserved)
const HEALTH_PREFIX = process.env.HEALTH_ROUTE_PREFIX || "/health";
const WORKSPACE_PREFIX = process.env.WORKSPACE_ROUTE_PREFIX || "/workspace";
const FILES_PREFIX = process.env.FILES_ROUTE_PREFIX || "/files";

app.use(HEALTH_PREFIX, healthRouter);
app.use(WORKSPACE_PREFIX, workspaceRouter);
app.use(FILES_PREFIX, fileRouter);

// 404 JSON handler
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// Error handler must be last
app.use(errorHandler);

if (require.main === module) {
  try {
    console.log(`[FILES] Supabase URL: ${process.env.SUPABASE_URL || "unset"}`);
  } catch {}
  app.listen(PORT, () => {
    console.log(`Files Service listening on port ${PORT}`);
  });
}

export default app;
