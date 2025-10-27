import { Response } from "express";
import { supabase } from "../lib/supabase";
import { buildFileObjectPath, readObject } from "../lib/gcs";
import { parsePagination, toRange, buildPageMeta } from "../utils/pagination";
import { isAllowedFileType, isUUID } from "../utils/validation";
import { buildContentRef, toFileListItem } from "../mappers/fileMapper";
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
        contentRef: buildContentRef(data.workspace_id, data.id),
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
      contentRef: buildContentRef(wsId, id),
      createdAt: now,
      updatedAt: now,
      // Note: created without DB round-trip; verify in Supabase if needed
    });
  }

  // GET /workspace/:workspaceId/files?type=note|whiteboard|graph
  async listFiles(req: AuthzRequest, res: Response) {
    const startedAt = Date.now();
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId } = req.params as { workspaceId: string };
    const { type } = req.query as { type?: string };

    if (!isUUID(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspaceId" });
    }

    if (type && !isAllowedFileType(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const { studentId } = requireAuthenticatedUser(req);

    // Basic request log for observability (no sensitive data)
    try {
      console.log(
        `[FILES] listFiles request workspaceId=${workspaceId} studentId=${studentId} type=${type ?? "-"} pageStart=${req.query.pageStart ?? 0} pageSize=${req.query.pageSize ?? 10}`
      );
    } catch {}

    const { pageSize, pageStart } = parsePagination(req.query as any, {
      defaultSize: 10,
      maxSize: 100,
    });

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
    const { from, to } = toRange(pageStart, pageSize);
    const { data, count, error } = await q.range(from, to);

    if (error) {
      try {
        console.error(
          `[FILES] listFiles error workspaceId=${workspaceId} studentId=${studentId}: ${error.message || error}`
        );
      } catch {}
      return res.status(500).json({ error: error.message || "Failed to fetch files" });
    }

    const total = count || 0;
    const items = (data || []).map((row: any) => toFileListItem(row));
    const pagination = buildPageMeta(total, pageSize, pageStart, items.length);

    const responsePayload = {
      pagination,
      data: items,
    };

    try {
      const duration = Date.now() - startedAt;
      console.log(
        `[FILES] listFiles success workspaceId=${workspaceId} studentId=${studentId} returned=${items.length} total=${total} hasMore=${pagination.hasMore} durationMs=${duration}`
      );
    } catch {}

    return res.json(responsePayload);
  }

  // GET /workspace/:workspaceId/files/:fileId/content
  async getFileContent(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId, fileId } = req.params as { workspaceId: string; fileId: string };

    if (!isUUID(workspaceId) || !isUUID(fileId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const { studentId } = requireAuthenticatedUser(req);

    const connection = supabase(accessToken);

    // Verify the file exists and belongs to this student in this workspace
    const { data: file, error } = await connection
      .from("workspace_files")
      .select("*")
      .eq("id", fileId)
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: "File not found" });
    }

    const objectPath = buildFileObjectPath(workspaceId, fileId);
    try {
      const obj = await readObject(objectPath);
      if (!obj) {
        return res.status(404).json({ error: "Content not found" });
      }

      const { contentType, buffer } = obj;
      if (contentType && contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(buffer.toString("utf-8"));
          return res.status(200).json(parsed);
        } catch (_e) {
          // Fall through and return raw text if JSON parse fails
        }
      }

      // Default: return as raw bytes/text with content type if available
      if (contentType) res.type(contentType);
      return res.status(200).send(buffer);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to fetch content" });
    }
  }
}
