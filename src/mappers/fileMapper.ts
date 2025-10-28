import { WorkspaceFileRow } from "../types/db";

/**
 * Build a stable, client-facing content URL for a file.
 * - Notes use the notes path: /workspace/:workspaceId/notes/:id/content
 * - All other types use the files path: /workspace/:workspaceId/files/:id/content
 */
export function buildContentRef(workspaceId: string, fileId: string, type?: string) {
  if (type === "note") {
    return `/workspace/${workspaceId}/notes/${fileId}/content`;
  }
  return `/workspace/${workspaceId}/files/${fileId}/content`;
}

/**
 * Map a DB row into the list item shape returned by the API, including
 * a type-aware contentRef.
 */
export function toFileListItem(row: WorkspaceFileRow) {
  return {
    id: row.id,
    type: row.type,
    studentId: row.student_id,
    workspaceId: row.workspace_id,
    name: row.name,
    contentRef: buildContentRef(row.workspace_id, row.id, row.type),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

