import express from "express";
import { FilesController } from "../controllers/filesController";
import { authenticateUser } from "../middleware/authenticateUser";
import { asyncHandler } from "../errorHandler";

const router = express.Router();

const controller = new FilesController();

router.post(
  "/",
  authenticateUser,
  asyncHandler(controller.createFile.bind(controller))
);

// Convenience notes endpoints (default workspace = authenticated user id)
router.get(
  "/notes",
  authenticateUser,
  asyncHandler(controller.listMyNotes.bind(controller))
);

router.get(
  "/notes/:noteId",
  authenticateUser,
  asyncHandler(controller.getMyNote.bind(controller))
);

router.post(
  "/notes",
  authenticateUser,
  asyncHandler(controller.createMyNote.bind(controller))
);

export default router;

