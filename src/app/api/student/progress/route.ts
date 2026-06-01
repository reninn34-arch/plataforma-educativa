import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { progress, subjects, nodes, userProgress, modules } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const rows = await db
      .select({
        id: subjects.id,
        slug: subjects.slug,
        totalNodes: sql<number>`count(distinct ${nodes.id})`,
        completedNodes:
          sql<number>`count(distinct case when ${userProgress.status} = 'completed' then ${nodes.id} end)`,
        totalStars:
          sql<number>`coalesce(sum(${userProgress.starsEarned}), 0)`,
      })
      .from(subjects)
      .leftJoin(modules, eq(modules.subjectId, subjects.id))
      .leftJoin(nodes, eq(nodes.moduleId, modules.id))
      .leftJoin(userProgress, and(eq(userProgress.nodeId, nodes.id), eq(userProgress.userId, user.id)))
      .groupBy(subjects.id);

    const result: Record<string, { percentage: number; completedNodes: number; totalNodes: number; totalStars: number }> = {};

    for (const row of rows) {
      const percentage = row.totalNodes > 0
        ? Math.round((row.completedNodes / row.totalNodes) * 100)
        : 0;

      result[row.slug] = {
        percentage,
        completedNodes: row.completedNodes,
        totalNodes: row.totalNodes,
        totalStars: row.totalStars,
      };

      try {
        const existing = await db
          .select({ id: progress.id })
          .from(progress)
          .where(and(eq(progress.userId, user.id), eq(progress.subjectId, row.id)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(progress).set({ percentage }).where(eq(progress.id, existing[0].id));
        } else {
          await db.insert(progress).values({ userId: user.id, subjectId: row.id, percentage });
        }
      } catch {
        // skip sync on error, return computed data
      }
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al cargar progreso" }, { status: 500 });
  }
}
