import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  practiceSessions,
  practiceAnswers,
  userProgress,
  nodes,
  modules,
  progress,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "student") return NextResponse.json({ error: "Solo estudiantes" }, { status: 403 });

  try {
    const body = await request.json();
    const { subjectId, correctCount, totalCount, score, maxCombo, answers, nodeId } = body;

    if (subjectId == null) {
      return NextResponse.json({ error: "subjectId requerido" }, { status: 400 });
    }

    const [session] = await db
      .insert(practiceSessions)
      .values({
        userId: user.id,
        subjectId,
        correctCount,
        totalCount,
        score,
        maxCombo,
      })
      .returning();

    if (answers && answers.length > 0) {
      await db.insert(practiceAnswers).values(
        answers.map((a: { question: string; type: string; topic?: string; studentAnswer: string; isCorrect: boolean }) => ({
          sessionId: session.id,
          userId: user.id,
          subjectId,
          question: a.question,
          type: a.type,
          topic: a.topic ? a.topic.substring(0, 100) : null,
          studentAnswer: a.studentAnswer,
          isCorrect: a.isCorrect,
        }))
      );
    }

    // Update userProgress for the completed node
    if (nodeId) {
      const accuracy = totalCount > 0 ? correctCount / totalCount : 0;
      const stars = accuracy >= 1 ? 3 : accuracy >= 0.6 ? 2 : accuracy > 0 ? 1 : 0;

      const existing = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, user.id), eq(userProgress.nodeId, nodeId)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(userProgress)
          .set({
            status: "completed",
            starsEarned: Math.max(existing[0].starsEarned, stars),
            attempts: existing[0].attempts + 1,
          })
          .where(eq(userProgress.id, existing[0].id));
      } else {
        await db.insert(userProgress).values({
          userId: user.id,
          nodeId,
          status: "completed",
          starsEarned: stars,
          attempts: 1,
        });
      }

      // Unlock next node in the same module if it exists
      const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
      if (node.length > 0) {
        const nextNode = await db
          .select()
          .from(nodes)
          .where(and(eq(nodes.moduleId, node[0].moduleId), eq(nodes.order, node[0].order + 1)))
          .limit(1);

        if (nextNode.length > 0) {
          const nextExisting = await db
            .select()
            .from(userProgress)
            .where(
              and(eq(userProgress.userId, user.id), eq(userProgress.nodeId, nextNode[0].id))
            )
            .limit(1);

          if (nextExisting.length > 0 && nextExisting[0].status === "locked") {
            await db
              .update(userProgress)
              .set({ status: "unlocked" })
              .where(eq(userProgress.id, nextExisting[0].id));
          } else if (nextExisting.length === 0) {
            await db.insert(userProgress).values({
              userId: user.id,
              nodeId: nextNode[0].id,
              status: "unlocked",
              starsEarned: 0,
              attempts: 0,
            });
          }
        }
      }

      // Recalculate progress.percentage for the subject
      const subjectModules = await db
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.subjectId, subjectId));

      const moduleIds = subjectModules.map(m => m.id);
      if (moduleIds.length > 0) {
        const allNodes = await db
          .select({ id: nodes.id })
          .from(nodes)
          .where(inArray(nodes.moduleId, moduleIds));

        const totalNodes = allNodes.length;
        const nodeIds = allNodes.map(n => n.id);

        const completed = await db
          .select()
          .from(userProgress)
          .where(
            and(
              eq(userProgress.userId, user.id),
              inArray(userProgress.nodeId, nodeIds),
              eq(userProgress.status, "completed")
            )
          );

        const percentage = totalNodes > 0
          ? Math.round((completed.length / totalNodes) * 100)
          : 0;

        const progressRecord = await db
          .select()
          .from(progress)
          .where(and(eq(progress.userId, user.id), eq(progress.subjectId, subjectId)))
          .limit(1);

        if (progressRecord.length > 0) {
          await db
            .update(progress)
            .set({ percentage, lastActivity: new Date() })
            .where(eq(progress.id, progressRecord[0].id));
        } else {
          await db.insert(progress).values({
            userId: user.id,
            subjectId,
            percentage,
            lastActivity: new Date(),
          });
        }
      }
    }

    return NextResponse.json({ saved: true, sessionId: session.id });
  } catch (error) {
    console.error("Save session error:", error);
    return NextResponse.json({ error: "Error al guardar sesion" }, { status: 500 });
  }
}
