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

// GET /workspace/:workspaceId/files/:fileId/content
router.get(
  "/:workspaceId/files/:fileId/content",
  authenticateUser,
  asyncHandler(controller.getFileContent.bind(controller))
);

// GET /workspace/:workspaceId/notes/:noteId/content
// Returns the content of a note for the authenticated user.
// - Enforces type === 'note' and workspace/ownership checks.
// - Reads from GCS at workspace/<ws>/notes/<id>; falls back to legacy files/<id>.
router.get(
  "/:workspaceId/notes/:noteId/content",
  authenticateUser,
  asyncHandler(controller.getNoteContent.bind(controller))
);

// PUT /workspace/:workspaceId/notes/:noteId/content
// Upload/replace note content for the authenticated user.
// - Enforces type === 'note' and workspace/ownership checks.
// - Writes JSON (or raw body) to GCS at workspace/<ws>/notes/<id>.
router.put(
  "/:workspaceId/notes/:noteId/content",
  authenticateUser,
  asyncHandler(controller.putNoteContent.bind(controller))
);

export default router;
