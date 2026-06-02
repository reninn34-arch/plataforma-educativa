import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studyMaterials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = _request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(_request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await db.delete(studyMaterials).where(eq(studyMaterials.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[study-material] delete error:", error);
    return NextResponse.json({ error: "Error al eliminar material" }, { status: 500 });
  }
}
