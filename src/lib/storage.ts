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
    await put(`assignments/${filename}`, buffer, {
      contentType,
      access: "private",
      addRandomSuffix: false,
    });
  } else {
    const dir = UPLOADS_DIR;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
  }
  return `/api/uploads/assignments/${filename}`;
}

export async function deleteFile(urlOrFilename: string): Promise<void> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import("@vercel/blob");
    await del(`assignments/${urlOrFilename.split("/").pop()}`);
    return;
  }
  const name = urlOrFilename.split("/").pop() || urlOrFilename;
  const filePath = join(UPLOADS_DIR, name);
  if (existsSync(filePath)) await unlink(filePath);
}

export async function getFileBuffer(filename: string): Promise<Buffer> {
  return readFile(join(UPLOADS_DIR, filename));
}

export async function getBlobSignedUrl(filename: string): Promise<string> {
  const { head } = await import("@vercel/blob");
  const blob = await head(`assignments/${filename}`);
  return blob.url;
}
