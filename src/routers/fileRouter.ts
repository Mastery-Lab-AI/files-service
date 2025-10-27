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

export default router;

