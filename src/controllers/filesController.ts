import { Request, Response } from "express";
import { supabase } from "../lib/supabase";

export class FilesController {
  
  async createFile(req: Request, res: Response) {
    console.log("Creating file with body:", req.body);
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      throw new Error("Unauthorized");
    }

    const { workspace_id, name, student_id, type } = req.body;

    const connection = supabase(accessToken);

    // insert row into files table
    const { data, error } = await connection
      .from("workspace_files")
      .insert([
        {
          workspace_id: workspace_id,
          student_id: student_id, // should come from auth later, get auth to get student id
          type,
          name,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
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
  }
}
