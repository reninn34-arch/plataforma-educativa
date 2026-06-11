import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  practiceSessions,
  practiceAnswers,
  userProgress,
  nodes,
  modules,
  progress,
  studentModules,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { verifyToken, getVerifiedUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("atlas-edu-token")?.value;
  const user = getVerifiedUser(request) ?? (token ? await verifyToken(token) : null);
  if (!user || user.role !== "student") return NextResponse.json({ error: "Solo estudiantes" }, { status: 403 });

  try {
    const body = await request.json();
    const { subjectId, correctCount, totalCount, score, maxCombo, answers, nodeId } = body;

    if (subjectId == null) {
      return NextResponse.json({ error: "subjectId requerido" }, { status: 400 });
    }

    // Insert session (independent)
    const [session] = await db
      .insert(practiceSessions)
      .values({ userId: user.id, subjectId, correctCount, totalCount, score, maxCombo })
      .returning();

    // Insert answers (batch)
    if (answers && answers.length > 0) {
      await db.insert(practiceAnswers).values(
        answers.map((a: { question: string; type: string; topic?: string; studentAnswer: string; isCorrect: boolean }) => ({
          sessionId: session.id, userId: user.id, subjectId,
          question: a.question, type: a.type,
          topic: a.topic ? a.topic.substring(0, 100) : null,
          studentAnswer: a.studentAnswer, isCorrect: a.isCorrect,
        }))
      );
    }

    if (nodeId) {
      const accuracy = totalCount > 0 ? correctCount / totalCount : 0;
      const stars = accuracy >= 1 ? 3 : accuracy >= 0.6 ? 2 : accuracy > 0 ? 1 : 0;

      // Batch read: current node + next node in parallel
      const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);

      const nextNode = node.length > 0
        ? await db.select().from(nodes).where(
            and(eq(nodes.moduleId, node[0].moduleId), eq(nodes.order, node[0].order + 1))
          ).limit(1)
        : [];

      // Batch read: userProgress for current and next node
      const nodeIdsToCheck = [nodeId, ...(nextNode.length > 0 ? [nextNode[0].id] : [])];
      const existingProgress = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, user.id), inArray(userProgress.nodeId, nodeIdsToCheck)));

      const progressByNode = new Map(existingProgress.map(p => [p.nodeId, p]));

      // Upsert current node progress
      const current = progressByNode.get(nodeId);
      if (current) {
        await db.update(userProgress).set({
          status: "completed",
          starsEarned: Math.max(current.starsEarned, stars),
          attempts: current.attempts + 1,
        }).where(eq(userProgress.id, current.id));
      } else {
        await db.insert(userProgress).values({
          userId: user.id, nodeId, status: "completed", starsEarned: stars, attempts: 1,
        });
      }

      // Unlock next node if exists
      if (nextNode.length > 0) {
        const nextNodeData = nextNode[0];
        const next = progressByNode.get(nextNodeData.id);
        if (next) {
          if (next.status === "locked") {
            await db.update(userProgress).set({ status: "unlocked" }).where(eq(userProgress.id, next.id));
          }
        } else {
          await db.insert(userProgress).values({
            userId: user.id, nodeId: nextNodeData.id, status: "unlocked", starsEarned: 0, attempts: 0,
          });
        }
      }

      // Batch read for progress recalculation
      const [subjectModules, progressRecord] = await Promise.all([
        db.select({ id: modules.id }).from(modules).innerJoin(studentModules, and(eq(studentModules.moduleId, modules.id), eq(studentModules.studentId, user.id))).where(eq(modules.subjectId, subjectId)),
        db.select().from(progress).where(and(eq(progress.userId, user.id), eq(progress.subjectId, subjectId))).limit(1),
      ]);

      const moduleIds = subjectModules.map(m => m.id);
      if (moduleIds.length > 0) {
        const allNodes = await db.select({ id: nodes.id }).from(nodes).where(inArray(nodes.moduleId, moduleIds));
        const nodeIds = allNodes.map(n => n.id);

        const completedProgress = await db
          .select()
          .from(userProgress)
          .where(and(eq(userProgress.userId, user.id), inArray(userProgress.nodeId, nodeIds), eq(userProgress.status, "completed")));

        const percentage = allNodes.length > 0 ? Math.round((completedProgress.length / allNodes.length) * 100) : 0;

        if (progressRecord.length > 0) {
          await db.update(progress).set({ percentage, lastActivity: new Date() }).where(eq(progress.id, progressRecord[0].id));
        } else {
          await db.insert(progress).values({ userId: user.id, subjectId, percentage, lastActivity: new Date() });
        }
      }
    }

    return NextResponse.json({ saved: true, sessionId: session.id });
  } catch (error) {
    console.error("Save session error:", error);
    return NextResponse.json({ error: "Error al guardar sesion" }, { status: 500 });
  }
}
