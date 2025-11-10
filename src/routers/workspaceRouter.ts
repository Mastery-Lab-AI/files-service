import express from "express";
import { authenticateUser } from "../middleware/authenticateUser";
import { FilesController } from "../controllers/filesController";
import { asyncHandler } from "../errorHandler";

const router = express.Router();
const controller = new FilesController();
// Helper: accept raw bodies for non-JSON content types (e.g., text/markdown, application/pdf)
const rawUnlessJson = express.raw({
  type: (req) => {
    const ct = req.headers['content-type'] || '';
    return !ct.includes('application/json');
  },
  limit: '20mb',
});

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

// PUT /workspace/:workspaceId/files/:fileId/content
// Upload/replace content for any file type.
router.put(
  "/:workspaceId/files/:fileId/content",
  express.raw({ type: '*/*', limit: '20mb' }),
  authenticateUser,
  asyncHandler(controller.putFileContent.bind(controller))
);

// PUT /workspace/:workspaceId/files/:fileId/content
// Upload/replace content for any file type.
router.put(
  "/:workspaceId/files/:fileId/content",
  authenticateUser,
  asyncHandler(controller.putFileContent.bind(controller))
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
  rawUnlessJson,
  authenticateUser,
  asyncHandler(controller.putNoteContent.bind(controller))
);

// DELETE /workspace/:workspaceId/notes/:noteId
// Delete a note (DB row + content) the authenticated user owns in a workspace
router.delete(
  "/:workspaceId/notes/:noteId",
  authenticateUser,
  asyncHandler(controller.deleteNote.bind(controller))
);

// POST /workspace/:workspaceId/files (create any file type in workspace)
router.post(
  "/:workspaceId/files",
  authenticateUser,
  asyncHandler(controller.createFileInWorkspace.bind(controller))
);

// PATCH /workspace/:workspaceId/files/:fileId (rename/metadata)
router.patch(
  "/:workspaceId/files/:fileId",
  authenticateUser,
  asyncHandler(controller.updateFile.bind(controller))
);

// DELETE /workspace/:workspaceId/files/:fileId (generic deletion)
router.delete(
  "/:workspaceId/files/:fileId",
  authenticateUser,
  asyncHandler(controller.deleteFile.bind(controller))
);

// POST /workspace/:workspaceId/files (create any file type in workspace)
router.post(
  "/:workspaceId/files",
  authenticateUser,
  asyncHandler(controller.createFileInWorkspace.bind(controller))
);

// PATCH /workspace/:workspaceId/files/:fileId (rename/metadata)
router.patch(
  "/:workspaceId/files/:fileId",
  authenticateUser,
  asyncHandler(controller.updateFile.bind(controller))
);

// DELETE /workspace/:workspaceId/files/:fileId (generic deletion)
router.delete(
  "/:workspaceId/files/:fileId",
  authenticateUser,
  asyncHandler(controller.deleteFile.bind(controller))
);

export default router;
