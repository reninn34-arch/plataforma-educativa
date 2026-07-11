import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOADS_DIR = join(process.cwd(), "uploads", "assignments");

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`assignments/${filename}`, buffer, {
      contentType,
      access: "private",
      addRandomSuffix: false,
    });
    return blob.url;
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(join(UPLOADS_DIR, filename), buffer);
  return `/api/uploads/assignments/${filename}`;
}

export async function deleteFile(urlOrFilename: string): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    if (urlOrFilename.startsWith("http")) {
      const { del } = await import("@vercel/blob");
      await del(urlOrFilename);
    }
    return;
  }
  const name = urlOrFilename.startsWith("http")
    ? urlOrFilename.split("/").pop() || ""
    : urlOrFilename.startsWith("/api/")
      ? urlOrFilename.split("/").pop() || ""
      : urlOrFilename;
  const filePath = join(UPLOADS_DIR, name);
  if (existsSync(filePath)) await unlink(filePath);
}

export async function getFileBuffer(url: string): Promise<Buffer> {
  if (process.env.BLOB_READ_WRITE_TOKEN && url.startsWith("http")) {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }
  // Extract filename from /api/uploads/assignments/{filename} or use as-is
  const filename = url.startsWith("/api/uploads/assignments/")
    ? url.split("/").pop() || ""
    : url.split("/").pop() || url;
  return readFile(join(UPLOADS_DIR, filename));
}
