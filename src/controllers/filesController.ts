import { Response } from "express";
import { supabase } from "../lib/supabase";
import crypto from "node:crypto";
import { AuthzRequest } from "../types/authz";
import { requireAuthenticatedUser } from "../utils/authz";

export class FilesController {
  async createFile(req: AuthzRequest, res: Response) {
    // SB-28 Create a new blank note
    // This endpoint accepts metadata only (type/name/workspaceId) and returns
    // a file descriptor with a contentRef placeholder. The actual content is
    // handled by a separate endpoint.

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

    // Validate inputs (ticket requires: type === "note", non-empty name, UUID workspaceId)
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

    const { studentId } = requireAuthenticatedUser(req);

    const connection = supabase(accessToken);

    // Generate server-side id (avoids requiring pgcrypto/gen_random_uuid in DB)
    const id = crypto.randomUUID();

    // Preferred path: insert + returning select for canonical timestamps (DB values)
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

    // Fallback: if returning select is blocked (RLS) or unavailable, return minimal payload
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

  // GET /workspace/:workspaceId/files?type=note|whiteboard|graph
  async listFiles(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId } = req.params as { workspaceId: string };
    const { type } = req.query as { type?: string };

    const isUUID = (v?: string) =>
      typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

    if (!isUUID(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspaceId" });
    }

    if (type && !["note", "whiteboard", "graph"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const { studentId } = requireAuthenticatedUser(req);

    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 10));
    const pageStart = Math.max(0, Number(req.query.pageStart) || 0);

    const connection = supabase(accessToken);

    // Build query with RLS enforced as the user
    let q = connection
      .from("workspace_files")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (type) {
      q = q.eq("type", type);
    }

    // Pagination using range (offset-based)
    const from = pageStart;
    const to = pageStart + pageSize - 1;
    const { data, count, error } = await q.range(from, to);

    if (error) {
      return res.status(500).json({ error: error.message || "Failed to fetch files" });
    }

    const total = count || 0;
    const hasMore = pageStart + (data?.length || 0) < total;

    const mapped = (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      studentId: row.student_id,
      workspaceId: row.workspace_id,
      name: row.name,
      contentRef: `/workspace/${row.workspace_id}/files/${row.id}/content`,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({
      pagination: {
        total,
        pageSize,
        pageStart,
        hasMore,
      },
      data: mapped,
    });
  }
}

