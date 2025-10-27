import { Storage, GetFileMetadataResponse } from "@google-cloud/storage";

const bucketName = process.env.GCS_BUCKET_NAME;

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    // Will use ADC (Application Default Credentials):
    // - GOOGLE_APPLICATION_CREDENTIALS
    // - Or workload identity / GCE metadata
    storage = new Storage();
  }
  return storage;
}

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

export function buildFileObjectPath(workspaceId: string, fileId: string) {
  return `workspace/${workspaceId}/files/${fileId}`;
}

