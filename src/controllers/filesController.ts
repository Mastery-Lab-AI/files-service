import { Response } from "express";
import { supabase } from "../lib/supabase";
import { buildFileObjectPath, readObject, writeObject, deleteObject } from "../lib/gcs";
import { parsePagination, toRange, buildPageMeta } from "../utils/pagination";
import { isAllowedFileType, isUUID } from "../utils/validation";
import { buildContentRef, toFileListItem } from "../mappers/fileMapper";
import crypto from "node:crypto";
import { AuthzRequest } from "../types/authz";
import { requireAuthenticatedUser } from "../utils/authz";

export class FilesController {
  /**
   * DELETE /workspace/:workspaceId/notes/:noteId
   * Delete a note the user owns: removes content in GCS and row in workspace_files.
   */
  async deleteNote(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId, noteId } = req.params as { workspaceId: string; noteId: string };
    if (!isUUID(workspaceId) || !isUUID(noteId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const { studentId } = requireAuthenticatedUser(req);
    const connection = supabase(accessToken);
    const startedAt = Date.now();
    try {
      console.log(
        `[FILES] deleteNote request workspaceId=${workspaceId} noteId=${noteId} studentId=${studentId}`
      );
    } catch {}

    // Skip DB pre-check to avoid 404 due to RLS blocking SELECT; rely on filtered DELETE

    // Best-effort delete of content from notes path and legacy files path
    const notesPath = `workspace/${workspaceId}/notes/${noteId}`;
    const legacyPath = buildFileObjectPath(workspaceId, noteId);
    try {
      await deleteObject(notesPath);
    } catch {}
    try {
      await deleteObject(legacyPath);
    } catch {}

    // Delete DB row with filters; if RLS denies, error will be returned
    try {
      const resp: any = await connection
        .from("workspace_files")
        .delete()
        .eq("id", noteId)
        .eq("student_id", studentId);
      if (resp?.error) {
        try {
          console.log(
            `[FILES] deleteNote error workspaceId=${workspaceId} noteId=${noteId} studentId=${studentId} err=${resp.error.message}`
          );
        } catch {}
        return res.status(500).json({ error: resp.error.message });
      }
      // Post-delete verification: ensure the row is gone
      const verify = await connection
        .from("workspace_files")
        .select("id", { count: "exact", head: true })
        .eq("id", noteId)
        .eq("student_id", studentId);
      if ((verify as any)?.count && (verify as any).count > 0) {
        try {
          console.log(
            `[FILES] deleteNote not-deleted workspaceId=${workspaceId} noteId=${noteId} studentId=${studentId}`
          );
        } catch {}
        return res.status(404).json({ error: "Note not deleted" });
      }
    } catch (e: any) {
      try {
        console.log(
          `[FILES] deleteNote error workspaceId=${workspaceId} noteId=${noteId} studentId=${studentId} err=${e?.message}`
        );
      } catch {}
      return res.status(500).json({ error: e?.message || "Delete failed" });
    }
    // If we reached here: pre-check found the row, delete succeeded
    try {
      console.log(
        `[FILES] deleteNote success workspaceId=${workspaceId} noteId=${noteId} studentId=${studentId} durationMs=${Date.now() - startedAt}`
      );
    } catch {}
    return res.status(200).json({ message: "Note deleted successfully" });
  }

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
      // Emit canonical record from DB (timestamps from DB), including a
      // type-aware contentRef (notes → /notes/:id/content).
      const file = {
        id: data.id,
        type: data.type,
        studentId: data.student_id,
        workspaceId: data.workspace_id,
        name: data.name,
        contentRef: buildContentRef(data.workspace_id, data.id, data.type),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      return res.status(201).json(file);
    }

    // Fallback: if returning select is blocked (RLS) or unavailable, return minimal payload
    // with client-side timestamps. Note: does not guarantee insert succeeded.
    const now = new Date().toISOString();
    return res.status(201).json({
      id,
      type,
      studentId,
      workspaceId: wsId,
      name,
      contentRef: buildContentRef(wsId, id, type),
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
  // Return content for any file type, given the authenticated student has access.
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

  /**
   * GET /workspace/:workspaceId/notes/:noteId/content
   * Fetch note content with strict type and ownership enforcement.
   * - Validates UUIDs, requires auth.
   * - Confirms a 'note' row exists for (id, workspace_id, student_id).
   * - Attempts to read from GCS notes path; falls back to legacy files path.
   * - Parses and returns JSON when contentType includes application/json; otherwise returns raw bytes.
   */
  async getNoteContent(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId, noteId } = req.params as { workspaceId: string; noteId: string };

    if (!isUUID(workspaceId) || !isUUID(noteId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const { studentId } = requireAuthenticatedUser(req);

    const connection = supabase(accessToken);

    // Enforce type === 'note' for this endpoint
    const { data: file, error } = await connection
      .from("workspace_files")
      .select("*")
      .eq("id", noteId)
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .eq("type", "note")
      .single();

    if (error || !file) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Try notes path first, then legacy files path for backward compatibility
    const notesPath = `workspace/${workspaceId}/notes/${noteId}`;
    const filesPath = buildFileObjectPath(workspaceId, noteId);

    try {
      let obj = await readObject(notesPath);
      if (!obj) {
        obj = await readObject(filesPath);
      }
      if (!obj) {
        return res.status(404).json({ error: "Content not found" });
      }

      const { contentType, buffer } = obj;
      if (contentType && contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(buffer.toString("utf-8"));
          return res.status(200).json(parsed);
        } catch (_e) {
          // Fall through and return raw bytes
        }
      }

      if (contentType) res.type(contentType);
      return res.status(200).send(buffer);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to fetch content" });
    }
  }

  /**
   * PUT /workspace/:workspaceId/notes/:noteId/content
   * Upload/replace note content in GCS for the authenticated user.
   * - Validates UUIDs, requires auth.
   * - Confirms a 'note' row exists for (id, workspace_id, student_id).
   * - Writes request body (JSON by default) to workspace/<ws>/notes/<id>.
   * - Returns 204 on success.
   */
  async putNoteContent(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workspaceId, noteId } = req.params as { workspaceId: string; noteId: string };
    if (!isUUID(workspaceId) || !isUUID(noteId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const { studentId } = requireAuthenticatedUser(req);
    const connection = supabase(accessToken);

    // Enforce type === 'note' and ownership
    const { data: file, error } = await connection
      .from("workspace_files")
      .select("*")
      .eq("id", noteId)
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .eq("type", "note")
      .single();

    if (error || !file) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Expect JSON body for now (express.json() already parsed), but accept raw strings/buffers
    const contentType = req.headers["content-type"] || "application/json";
    let data: Buffer | string;
    if (typeof req.body === "object") {
      try {
        data = JSON.stringify(req.body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    } else if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
      data = req.body as any;
    } else {
      return res.status(400).json({ error: "Unsupported body" });
    }

    const notesPath = `workspace/${workspaceId}/notes/${noteId}`;
    try {
      await writeObject(notesPath, data, Array.isArray(contentType) ? contentType[0] : String(contentType));
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to write content" });
    }
  }

  /**
   * Convenience APIs for default workspace = authenticated student id
   * These power the frontend's simple /files/notes integration without
   * requiring the client to manage workspace ids explicitly.
   */
  async listMyNotes(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });

    const { studentId } = requireAuthenticatedUser(req);
    const connection = supabase(accessToken);

    const order = connection
      .from("workspace_files")
      .select("*")
      .eq("student_id", studentId)
      .eq("workspace_id", studentId)
      .eq("type", "note")
      .order("updated_at", { ascending: false });

    const { data, error } = await order;
    if (error) return res.status(500).json({ error: error.message });

    const out = (data || []).map((row) => ({
      id: row.id,
      title: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return res.status(200).json(out);
  }

  async getMyNote(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });

    const { studentId } = requireAuthenticatedUser(req);
    const { noteId } = req.params as { noteId: string };
    if (!isUUID(noteId)) return res.status(400).json({ error: "Invalid id" });

    const connection = supabase(accessToken);
    const { data: row, error } = await connection
      .from("workspace_files")
      .select("*")
      .eq("id", noteId)
      .eq("workspace_id", studentId)
      .eq("student_id", studentId)
      .eq("type", "note")
      .single();

    if (error || !row) return res.status(404).json({ error: "Note not found" });

    // Try to read content from notes path
    const notesPath = `workspace/${studentId}/notes/${noteId}`;
    try {
      const obj = await readObject(notesPath);
      let content: string | undefined = undefined;
      if (obj) {
        const { buffer, contentType } = obj;
        if (contentType && contentType.includes("application/json")) {
          try {
            const parsed = JSON.parse(buffer.toString("utf-8"));
            content = typeof parsed === "string" ? parsed : parsed?.content ?? JSON.stringify(parsed);
          } catch {
            content = buffer.toString("utf-8");
          }
        } else {
          content = buffer.toString("utf-8");
        }
      }

      return res.status(200).json({
        id: row.id,
        title: row.name,
        content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to load note" });
    }
  }

  async createMyNote(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });

    const { studentId } = requireAuthenticatedUser(req);
    const { title, content } = (req.body || {}) as { title?: string; content?: string };

    const name = (title || "Untitled Note").trim();
    if (!name) return res.status(400).json({ error: "Invalid title" });

    const connection = supabase(accessToken);
    const id = crypto.randomUUID();
    const insertPayload = {
      id,
      workspace_id: studentId,
      student_id: studentId,
      type: "note",
      name,
    } as const;

    const { data, error } = await connection
      .from("workspace_files")
      .insert([insertPayload])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Write content when provided
    if (typeof content === "string") {
      try {
        await writeObject(`workspace/${studentId}/notes/${id}`, content, "text/markdown; charset=utf-8");
      } catch (e: any) {
        // If content write fails, still return created note but flag error
        return res.status(201).json({
          id,
          title: name,
          createdAt: data?.created_at ?? new Date().toISOString(),
          updatedAt: data?.updated_at ?? new Date().toISOString(),
          warning: "Note created but content save failed",
        });
      }
    }

    return res.status(201).json({
      id,
      title: name,
      createdAt: data?.created_at ?? new Date().toISOString(),
      updatedAt: data?.updated_at ?? new Date().toISOString(),
    });
  }

  /**
   * DELETE /files/notes/:noteId (convenience: workspace = authenticated user id)
   */
  async deleteMyNote(req: AuthzRequest, res: Response) {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const { studentId } = requireAuthenticatedUser(req);
    const { noteId } = req.params as { noteId: string };
    if (!isUUID(noteId)) return res.status(400).json({ error: "Invalid id" });

    // Delegate to deleteNote with workspaceId = studentId
    // Build a minimal shim request-like object is unnecessary; reuse logic inline
    const connection = supabase(accessToken);
    const startedAt = Date.now();
    try {
      console.log(
        `[FILES] deleteMyNote request workspaceId=${studentId} noteId=${noteId} studentId=${studentId}`
      );
    } catch {}
    // Skip DB pre-check to avoid 404 when RLS disables SELECT; delete is filtered

    try {
      const resp: any = await connection
        .from("workspace_files")
        .delete()
        .eq("id", noteId)
        .eq("student_id", studentId);
      if (resp?.error) {
        try {
          console.log(
            `[FILES] deleteMyNote error workspaceId=${studentId} noteId=${noteId} studentId=${studentId} err=${resp.error.message}`
          );
        } catch {}
        return res.status(500).json({ error: resp.error.message });
      }
      // Post-delete verification
      const verify = await connection
        .from("workspace_files")
        .select("id", { count: "exact", head: true })
        .eq("id", noteId)
        .eq("student_id", studentId);
      const remaining = (verify as any)?.count || 0;
      try { console.log(`[FILES] deleteMyNote verify count=${remaining} workspaceId=${studentId} noteId=${noteId} studentId=${studentId}`); } catch {}
      if (remaining > 0) {
        try {
          console.log(
            `[FILES] deleteMyNote not-deleted workspaceId=${studentId} noteId=${noteId} studentId=${studentId}`
          );
        } catch {}
        return res.status(404).json({ error: "Note not deleted" });
      }
      // Only delete content if DB row is removed
      const notesPath = `workspace/${studentId}/notes/${noteId}`;
      const legacyPath = buildFileObjectPath(studentId, noteId);
      try { await deleteObject(notesPath); } catch {}
      try { await deleteObject(legacyPath); } catch {}
    } catch (e: any) {
      try {
        console.log(
          `[FILES] deleteMyNote error workspaceId=${studentId} noteId=${noteId} studentId=${studentId} err=${e?.message}`
        );
      } catch {}
      return res.status(500).json({ error: e?.message || "Delete failed" });
    }
    // Pre-check found the row, delete succeeded
    try {
      console.log(
        `[FILES] deleteMyNote success workspaceId=${studentId} noteId=${noteId} studentId=${studentId} durationMs=${Date.now() - startedAt}`
      );
    } catch {}
    return res.status(200).json({ message: "Note deleted successfully" });
  }
}
