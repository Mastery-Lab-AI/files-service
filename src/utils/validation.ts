export const FILE_TYPES = ["note", "whiteboard", "graph", "document"] as const;
export type FileType = typeof FILE_TYPES[number];

export function isUUID(v?: string): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export function isAllowedFileType(v?: string): v is FileType {
  return typeof v === "string" && (FILE_TYPES as readonly string[]).includes(v);
}

