import express from "express";
import "dotenv/config";

import {errorHandler} from "./errorHandler";
import healthRouter from "./routers/healthRouter";
import fileRouter from "./routers/fileRouter";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/health", healthRouter)
app.use("/files", fileRouter)

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Files Service listening on port ${PORT}`);
});
