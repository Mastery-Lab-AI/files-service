import express from "express";
import { authenticateUser } from "../middleware/authenticateUser";
import { FilesController } from "../controllers/filesController";
import { asyncHandler } from "../errorHandler";

const router = express.Router();
const controller = new FilesController();

// GET /workspace/:workspaceId/files?type=note|whiteboard|graph
router.get(
  "/:workspaceId/files",
  authenticateUser,
  asyncHandler(controller.listFiles.bind(controller))
);

export default router;
