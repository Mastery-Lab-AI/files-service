import { Request, Response } from "express";
import { supabase } from "../lib/supabase";

export async function createFile(req: Request, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { type, name, studentId } = req.body;

    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      throw new Error("Unauthorized");
    }

    const connection = supabase(accessToken);

    // insert row into files table
    const { data, error } = await connection
      .from("workspace_files")
      .insert([
        {
          workspace_id: workspaceId,
          student_id: studentId, // should come from auth later
          type,
          name,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const file = {
      id: data.id,
      type: data.type,
      studentId: data.student_id,
      workspaceId: data.workspace_id,
      name: data.name,
      contentRef: `/workspace/${data.workspace_id}/files/${data.id}/content`,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(201).json(file);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
