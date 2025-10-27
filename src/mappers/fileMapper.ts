import { WorkspaceFileRow } from "../types/db";

export function buildContentRef(workspaceId: string, fileId: string) {
  return `/workspace/${workspaceId}/files/${fileId}/content`;
}

export function toFileListItem(row: WorkspaceFileRow) {
  return {
    id: row.id,
    type: row.type,
    studentId: row.student_id,
    workspaceId: row.workspace_id,
    name: row.name,
    contentRef: buildContentRef(row.workspace_id, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

