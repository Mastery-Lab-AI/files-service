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

// Update my note (rename and/or content)
router.patch(
  "/notes/:noteId",
  authenticateUser,
  asyncHandler(controller.updateMyNote.bind(controller))
);
router.put(
  "/notes/:noteId",
  authenticateUser,
  asyncHandler(controller.updateMyNote.bind(controller))
);

router.delete(
  "/notes/:noteId",
  authenticateUser,
  asyncHandler(controller.deleteMyNote.bind(controller))
);

export default router;

