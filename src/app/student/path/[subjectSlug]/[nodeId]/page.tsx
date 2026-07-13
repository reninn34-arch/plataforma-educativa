import { db } from "@/lib/db";
import { subjects, nodes, modules, userProgress, studentModules } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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
    const mod = moduleRecord[0];

    // Module star requirement (only for AI-generated)
    if (mod.generated && mod.requiredPoints > 0) {
      const smIds = await db
        .select({ mid: studentModules.moduleId })
        .from(studentModules)
        .where(eq(studentModules.studentId, session.id));
      const smIdList = smIds.map(r => r.mid);

      const allSubjectNodes = await db
        .select({ id: nodes.id })
        .from(nodes)
        .leftJoin(modules, eq(nodes.moduleId, modules.id))
        .where(and(eq(modules.subjectId, subject.id), inArray(modules.id, smIdList.length > 0 ? smIdList : [-1])));
      const allNodeIds = allSubjectNodes.map(n => n.id);

      const allProgress = allNodeIds.length > 0
        ? await db.select({ stars: userProgress.starsEarned })
          .from(userProgress)
          .where(and(eq(userProgress.userId, session.id), inArray(userProgress.nodeId, allNodeIds)))
        : [];
      const totalStars = allProgress.reduce((sum, p) => sum + (p.stars || 0), 0);

      if (totalStars < mod.requiredPoints) {
        redirect(`/student/path/${subject.slug}`);
      }
    }
  }

  // Find next node in same module
  const nextNode = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(and(eq(nodes.moduleId, node.moduleId), eq(nodes.order, node.order + 1)))
    .limit(1);

  const isLastInModule = nextNode.length === 0;

  // Find next module's first node (if current is last in module)
  let nextModuleFirstNodeId: number | null = null;
  let nextModuleTitle: string | null = null;
  if (isLastInModule && moduleRecord.length > 0) {
    const currentModule = moduleRecord[0];
    const allSubjectModules = await db
      .select()
      .from(modules)
      .innerJoin(studentModules, and(eq(studentModules.moduleId, modules.id), eq(studentModules.studentId, session.id)))
      .where(eq(modules.subjectId, subject.id))
      .orderBy(studentModules.order);
    const allSubjectModulesFlat = allSubjectModules.map(r => r.modules);
    const currentModIndex = allSubjectModulesFlat.findIndex(m => m.id === currentModule.id);
    const nextMod = currentModIndex >= 0 ? allSubjectModulesFlat[currentModIndex + 1] : null;

    if (nextMod) {
      nextModuleTitle = nextMod.title;
      const firstNodeOfNext = await db
        .select({ id: nodes.id })
        .from(nodes)
        .where(and(eq(nodes.moduleId, nextMod.id), eq(nodes.order, 1)))
        .limit(1);
      if (firstNodeOfNext.length > 0) {
        nextModuleFirstNodeId = firstNodeOfNext[0].id;
      }
    }
  }

  const displayContext = node.aiPromptContext;

  return (
    <PracticeClient
      subjectSlug={subject.slug}
      nodeId={node.id}
      nodeTitle={node.title}
      aiPromptContext={displayContext}
      subjectId={subject.id}
      nextNodeId={nextNode.length > 0 ? nextNode[0].id : null}
      nextModuleFirstNodeId={nextModuleFirstNodeId}
      nextModuleTitle={nextModuleTitle}
    />
  );
}
