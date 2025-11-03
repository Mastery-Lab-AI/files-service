import { Storage, GetFileMetadataResponse } from "@google-cloud/storage";

const bucketName = process.env.GCS_BUCKET_NAME;

let storage: Storage | null = null;

/**
 * Lazily initialize a Google Cloud Storage client using Application Default Credentials (ADC).
 */
function getStorage(): Storage {
  if (!storage) {
    // Will use ADC (Application Default Credentials):
    // - GOOGLE_APPLICATION_CREDENTIALS
    // - Or workload identity / GCE metadata
    storage = new Storage();
  }
  return storage;
}

/**
 * Read an object from the configured bucket.
 * - Returns null if the object does not exist.
 * - Returns the raw buffer, detected contentType, and file metadata when present.
 */
export async function readObject(
  objectPath: string
): Promise<{ contentType?: string; buffer: Buffer; metadata: GetFileMetadataResponse[0] } | null> {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }
  const s = getStorage();
  const bucket = s.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return { contentType: metadata.contentType, buffer, metadata };
}

/**
 * Build the legacy files path used for non-note content and as a fallback for notes.
 * Example: workspace/<workspaceId>/files/<fileId>
 */
export function buildFileObjectPath(workspaceId: string, fileId: string) {
  return `workspace/${workspaceId}/files/${fileId}`;
}

/**
 * Write an object to the configured bucket at the given path.
 * - Overwrites any existing object at that path.
 * - Sets contentType (defaults to application/octet-stream).
 */
export async function writeObject(
  objectPath: string,
  data: Buffer | string,
  contentType?: string
): Promise<GetFileMetadataResponse[0]> {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }
  const s = getStorage();
  const bucket = s.bucket(bucketName);
  const file = bucket.file(objectPath);
  await file.save(data, {
    contentType: contentType || "application/octet-stream",
    resumable: false,
  });
  const [metadata] = await file.getMetadata();
  return metadata;
}

/**
 * Delete an object from the configured bucket.
 * - Returns true if the object was deleted or did not exist.
 * - Throws only on unexpected GCS errors.
 */
export async function deleteObject(objectPath: string): Promise<boolean> {
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }
  const s = getStorage();
  const bucket = s.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return true;
  await file.delete({ ignoreNotFound: true });
  return true;
}
