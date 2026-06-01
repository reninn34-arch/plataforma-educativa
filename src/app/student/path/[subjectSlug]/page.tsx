import { db } from "@/lib/db";
import { subjects, modules, nodes, userProgress } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock, Star, Play, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { PathSearch } from "./path-search";

export default async function PathPage({ params }: { params: Promise<{ subjectSlug: string }> }) {
  const session = await getUser();
  if (!session) redirect("/login");

  const resolvedParams = await params;

  const subjectRecord = await db.select().from(subjects).where(eq(subjects.slug, resolvedParams.subjectSlug)).limit(1);
  if (!subjectRecord.length) redirect("/student/dashboard");
  const subject = subjectRecord[0];

  const subjectModules = await db.select().from(modules).where(eq(modules.subjectId, subject.id)).orderBy(modules.order);

  const moduleIds = subjectModules.map(m => m.id);
  const allNodes = moduleIds.length > 0
    ? await db.select().from(nodes).where(inArray(nodes.moduleId, moduleIds)).orderBy(nodes.order)
    : [];

  const nodeIds = allNodes.map(n => n.id);
  const progressRecords = nodeIds.length > 0
    ? await db.select().from(userProgress).where(and(eq(userProgress.userId, session.id), inArray(userProgress.nodeId, nodeIds)))
    : [];

  const progressMap = new Map();
  for (const p of progressRecords) {
    progressMap.set(p.nodeId, p);
  }

  // Calculate stats
  const completedNodes = allNodes.filter(n => {
    const p = progressMap.get(n.id);
    return p?.status === "completed" || p?.status === "mastered";
  }).length;
  const totalNodes = allNodes.length;
  const subjectProgress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
  const totalStars = progressRecords.reduce((sum, p) => sum + (p.starsEarned || 0), 0);

  // Suggested topics from static nodes
  const staticModules = subjectModules.filter(m => !m.generated);
  const staticModuleIds = staticModules.map(m => m.id);
  const staticNodes = allNodes.filter(n => staticModuleIds.includes(n.moduleId));
  const suggestedTopics = [...new Set(staticNodes.map(n => n.title))];

  const generatedModules = subjectModules.filter(m => m.generated);
  const orderedModules = [
    ...staticModules,
    ...generatedModules.sort((a, b) => b.order - a.order),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <header className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-white/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-2xl mx-auto w-full">
          <Link href="/student/dashboard" className="text-[#475569] hover:bg-slate-100 p-2 rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl shrink-0">{subject.emoji}</span>
            <div className="min-w-0">
              <span className="text-base font-bold text-[#1A2332]">{subject.name}</span>
              <p className="text-xs text-[#94A3B8]">Camino de Aprendizaje</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-yellow-600">{totalStars}</span>
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <p className="text-sm font-bold text-slate-700">{subjectProgress}%</p>
              <p className="text-[10px] text-slate-400">{completedNodes}/{totalNodes}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 max-w-2xl mx-auto w-full overflow-hidden">
        <div className="space-y-6">
          <PathSearch subjectSlug={subject.slug} suggestedTopics={suggestedTopics} />

          <div className="space-y-12 pt-4">
            {orderedModules.map((mod, modIndex) => {
              const modNodes = allNodes.filter(n => n.moduleId === mod.id);
              if (modNodes.length === 0) return null;

              const modCompleted = modNodes.filter(n => {
                const p = progressMap.get(n.id);
                return p?.status === "completed" || p?.status === "mastered";
              }).length;
              const modPct = modNodes.length > 0 ? Math.round((modCompleted / modNodes.length) * 100) : 0;
              const isModLocked = mod.generated ? mod.requiredPoints > totalStars : false;

              return (
                <div key={mod.id} className="relative">
                  <div className={`
                    border-2 rounded-2xl p-5 mb-8 shadow-sm
                    ${isModLocked
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : mod.generated
                        ? 'bg-gradient-to-r from-purple-50 to-white border-purple-200'
                        : 'bg-white border-slate-200'
                    }
                  `}>
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {mod.generated ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                              <Sparkles className="h-3 w-3" />
                              IA
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Unidad {modIndex + 1}
                            </span>
                          )}
                          {isModLocked && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <Lock size={10} />
                              {mod.requiredPoints} ★ requeridas
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mt-1">{mod.title}</h2>
                        {mod.topic && (
                          <p className="text-xs text-purple-600 mt-0.5">Tema: {mod.topic}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex-1 max-w-[200px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${modPct}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">{modCompleted}/{modNodes.length} nodos</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6 py-4">
                    {modNodes.map((node, i) => {
                      const prog = progressMap.get(node.id);
                      const status = isModLocked ? "locked" : (prog?.status || "unlocked");
                      const isLocked = status === "locked";
                      const isCompleted = status === "completed" || status === "mastered";
                      const isCurrent = status === "unlocked";

                      // Check if previous node is completed for golden line
                      const prevNode = i > 0 ? modNodes[i - 1] : null;
                      const prevProg = prevNode ? progressMap.get(prevNode.id) : null;
                      const prevCompleted = prevProg?.status === "completed" || prevProg?.status === "mastered";
                      const currentCompleted = isCompleted;

                      const offset = i % 2 !== 0 ? "translate-x-12" : "-translate-x-12";

                      return (
                        <div key={node.id} className={`relative flex flex-col items-center ${offset}`}>
                          {i > 0 && (
                            <div className={`
                              absolute top-16 h-12 w-2 -z-10
                              ${prevCompleted ? 'bg-yellow-400' : 'bg-slate-200'}
                            `} />
                          )}

                          <div className="relative group">
                            {isCurrent && !isModLocked && (
                              <div className="absolute -inset-4 bg-primary/20 rounded-full animate-ping -z-10" />
                            )}

                            <Link href={(isLocked || isModLocked) ? "#" : `/student/path/${subject.slug}/${node.id}`}>
                              <button
                                disabled={isLocked || isModLocked}
                                className={`
                                  h-20 w-20 rounded-full flex items-center justify-center border-b-4 transition-all
                                  ${(isLocked || isModLocked) ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed' :
                                    isCompleted ? 'bg-yellow-400 border-yellow-500 text-white hover:-translate-y-1' :
                                    'bg-primary border-primary/80 text-white hover:-translate-y-1 scale-110 shadow-lg'
                                  }
                                `}
                              >
                                {isLocked || isModLocked ? <Lock size={28} /> : isCompleted ? <Check size={32} /> : <Play size={28} className="ml-1" />}
                              </button>
                            </Link>

                            {(isCompleted || isCurrent) && prog?.starsEarned > 0 && (
                              <div className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow border flex items-center">
                                <span className="text-xs font-bold text-yellow-500">{prog.starsEarned}</span>
                                <Star size={12} className="text-yellow-500 fill-yellow-500 ml-0.5" />
                              </div>
                            )}
                          </div>

                          <div className="mt-3 text-center w-40">
                            <span className={`text-sm font-bold ${isLocked ? 'text-slate-400' : 'text-slate-700'}`}>
                              {node.title}
                            </span>
                            {node.type === "concept" && !isLocked && (
                              <span className="block text-[10px] text-blue-500 mt-0.5">Enseñanza</span>
                            )}
                            {node.type === "challenge" && !isLocked && (
                              <span className="block text-[10px] text-orange-500 mt-0.5">Desafio</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {orderedModules.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg font-medium">No hay caminos de aprendizaje todavia</p>
                <p className="text-sm mt-1">Usa la barra de busqueda para generar tu primer camino con IA.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
