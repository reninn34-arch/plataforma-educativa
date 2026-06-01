import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodosLectivos } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "teacher") {
    return NextResponse.json({ error: "Solo docentes" }, { status: 403 });
  }

  try {
    const all = await db.select().from(periodosLectivos).orderBy(desc(periodosLectivos.createdAt));

    const [activePeriod] = await db
      .select()
      .from(periodosLectivos)
      .where(eq(periodosLectivos.activo, true))
      .limit(1);

    return NextResponse.json({
      periodos: all,
      active: activePeriod || null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Error al cargar periodos" }, { status: 500 });
  }
}
