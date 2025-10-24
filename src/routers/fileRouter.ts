import express from "express";
import { FilesController } from "../controllers/filesController";
import { authenticateUser } from "../middleware/authenticateUser";

const router = express.Router();

const controller = new FilesController();

router.post("/", authenticateUser, controller.createFile);

export default router;

