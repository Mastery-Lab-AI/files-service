import express from "express";
import {FilesController} from "../controllers/filesController";

const router = express.Router();

const controller = new FilesController();

router.post("/workspace/:workspaceId", controller.createFile);

export default router;

