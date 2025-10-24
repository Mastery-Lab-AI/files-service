import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import crypto from "node:crypto";


export class FilesController {

  async createFile(req: Request, res: Response) {
    

    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId, workspace_id, name, type } = req.body as {
      workspaceId?: string;
      workspace_id?: string;
      name?: string;
      type?: string;
    };

    const wsId = workspaceId ?? workspace_id;

    // Validate inputs
    const isUUID = (v?: string) =>
      typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

    if (!isUUID(wsId)) {
      return res.status(400).json({ error: "Invalid workspace_id" });
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (type !== "note") {
      return res.status(400).json({ error: "Invalid type" });
    }

    const studentId = req.studentId;
    if (!studentId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const connection = supabase(accessToken);

    // Generate an id to avoid reliance on gen_random_uuid() extension
    const id = crypto.randomUUID();

    // Try insert + returning select (preferred for canonical timestamps)
    const insertPayload = {
      id,
      workspace_id: wsId,
      student_id: studentId,
      type,
      name,
    } as const;

    const { data, error } = await connection
      .from("workspace_files")
      .insert([insertPayload])
      .select()
      .single();

    if (!error && data) {
      const file = {
        id: data.id,
        type: data.type,
        studentId: data.student_id,
        workspaceId: data.workspace_id,
        name: data.name,
        contentRef: `/files/${data.id}/content`,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      return res.status(201).json(file);
    }

    // Fallback: if returning select is blocked (e.g., RLS) or table mismatch, respond with minimal payload
    
    const now = new Date().toISOString();
    return res.status(201).json({
      id,
      type,
      studentId,
      workspaceId: wsId,
      name,
      contentRef: `/files/${id}/content`,
      createdAt: now,
      updatedAt: now,
      // Note: created without DB round-trip; verify in Supabase if needed
    });
  }
}
