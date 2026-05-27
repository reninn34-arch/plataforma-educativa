import { db } from "@/lib/db";
import { subjects, nodes, modules, userProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { PracticeClient } from "./practice-client";

export default async function NodePracticePage({ params }: { params: Promise<{ subjectSlug: string; nodeId: string }> }) {
  const session = await getUser();
  if (!session) redirect("/login");

  const resolvedParams = await params;
  const nodeId = parseInt(resolvedParams.nodeId, 10);

  const subjectRecord = await db.select().from(subjects).where(eq(subjects.slug, resolvedParams.subjectSlug)).limit(1);
  if (!subjectRecord.length) redirect("/student/dashboard");
  const subject = subjectRecord[0];

  const nodeRecord = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
  if (!nodeRecord.length) redirect(`/student/path/${subject.slug}`);
  const node = nodeRecord[0];

  // Check if node is locked (not first node in module)
  const moduleRecord = await db.select().from(modules).where(eq(modules.id, node.moduleId)).limit(1);
  if (moduleRecord.length > 0) {
    const firstNodeInModule = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(eq(nodes.moduleId, node.moduleId), eq(nodes.order, 1)))
      .limit(1);
    const isFirstNode = firstNodeInModule.length > 0 && firstNodeInModule[0].id === nodeId;

    if (!isFirstNode) {
      const prog = await db
        .select({ id: userProgress.id, status: userProgress.status })
        .from(userProgress)
        .where(and(eq(userProgress.userId, session.id), eq(userProgress.nodeId, nodeId)))
        .limit(1);

      if (prog.length === 0 || prog[0].status === "locked") {
        // Auto-unlock: if user completed the previous node, unlock this one
        const prevNode = await db
          .select({ id: nodes.id })
          .from(nodes)
          .where(and(eq(nodes.moduleId, node.moduleId), eq(nodes.order, node.order - 1)))
          .limit(1);

        if (prevNode.length > 0) {
          const prevProg = await db
            .select({ status: userProgress.status })
            .from(userProgress)
            .where(and(eq(userProgress.userId, session.id), eq(userProgress.nodeId, prevNode[0].id)))
            .limit(1);

          if (prevProg.length > 0 && (prevProg[0].status === "completed" || prevProg[0].status === "mastered")) {
            if (prog.length > 0) {
              await db.update(userProgress).set({ status: "unlocked" }).where(eq(userProgress.id, prog[0].id));
            } else {
              await db.insert(userProgress).values({
                userId: session.id,
                nodeId,
                status: "unlocked",
                starsEarned: 0,
                attempts: 0,
              });
            }
          } else {
            redirect(`/student/path/${subject.slug}`);
          }
        } else {
          redirect(`/student/path/${subject.slug}`);
        }
      }
    }
  }

  const moduleTitle = moduleRecord.length > 0 ? moduleRecord[0].title : "";

  // Find next node in same module
  const nextNode = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(and(eq(nodes.moduleId, node.moduleId), eq(nodes.order, node.order + 1)))
    .limit(1);

  const displayContext = [
    moduleTitle && `Modulo: ${moduleTitle}`,
    node.aiPromptContext,
  ].filter(Boolean).join(". ");

  return (
    <PracticeClient
      subjectSlug={subject.slug}
      nodeId={node.id}
      nodeTitle={node.title}
      aiPromptContext={displayContext}
      subjectId={subject.id}
      nextNodeId={nextNode.length > 0 ? nextNode[0].id : null}
    />
  );
}
