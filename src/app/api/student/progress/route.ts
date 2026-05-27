import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { progress, subjects, nodes, userProgress, modules } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
  const allSubjects = await db.select().from(subjects);

  const result: Record<string, { percentage: number; completedNodes: number; totalNodes: number; totalStars: number }> = {};

  for (const subject of allSubjects) {
    // Count total nodes for this subject
    const subjectModules = await db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.subjectId, subject.id));

    const moduleIds = subjectModules.map(m => m.id);
    let totalNodes = 0;
    let completedNodes = 0;
    let totalStars = 0;

    if (moduleIds.length > 0) {
      const subjectNodes = await db
        .select({ id: nodes.id })
        .from(nodes)
        .where(inArray(nodes.moduleId, moduleIds));

      totalNodes = subjectNodes.length;
      const nodeIds = subjectNodes.map(n => n.id);

      if (totalNodes > 0) {
        const completedRecords = await db
          .select()
          .from(userProgress)
          .where(
            and(
              eq(userProgress.userId, user.id),
              inArray(userProgress.nodeId, nodeIds),
              eq(userProgress.status, "completed")
            )
          );

        completedNodes = completedRecords.length;
      }

      // Stars calculation
      const starRecords = await db
        .select({ stars: userProgress.starsEarned })
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, user.id),
            inArray(userProgress.nodeId, nodeIds)
          )
        );
      totalStars = starRecords.reduce((sum, r) => sum + (r.stars || 0), 0);
    }

    const percentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    // Sync the progress table
    const existing = await db
      .select()
      .from(progress)
      .where(and(eq(progress.userId, user.id), eq(progress.subjectId, subject.id)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(progress)
        .set({ percentage })
        .where(eq(progress.id, existing[0].id));
    } else {
      try {
        await db.insert(progress).values({
          userId: user.id,
          subjectId: subject.id,
          percentage,
        });
      } catch {
        // User may have been deleted (stale JWT) — skip insert, return computed data anyway
      }
    }

    result[subject.slug] = { percentage, completedNodes, totalNodes, totalStars };
  }

  return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al cargar progreso" }, { status: 500 });
  }
}
