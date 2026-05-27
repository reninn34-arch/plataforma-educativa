import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("🌱 Sembrando base de datos Atlas Edu...\n");

  await db.delete(schema.chatMessages);
  await db.delete(schema.chatSessions);
  await db.delete(schema.progress);
  await db.delete(schema.userProgress);
  await db.delete(schema.nodes);
  await db.delete(schema.modules);
  await db.delete(schema.subjects);
  await db.delete(schema.users);
  console.log("🧹 Datos anteriores eliminados");

  const users = await db
    .insert(schema.users)
    .values([
      { cedula: "1723456789", pin: await bcrypt.hash("1234", 10), fullName: "Maria Elena Guaman", role: "student" },
      { cedula: "1700000001", pin: await bcrypt.hash("1234", 10), fullName: "Jose Luis Quishpe", role: "student" },
      { cedula: "1700000002", pin: await bcrypt.hash("1234", 10), fullName: "Ana Lucia Paredes", role: "student" },
      { cedula: "1799999999", pin: await bcrypt.hash("5678", 10), fullName: "Prof. Patricio Mena", role: "teacher" },
    ])
    .returning();
  console.log(`👤 ${users.length} usuarios creados: 3 estudiantes + 1 docente`);

  const subjects = await db
    .insert(schema.subjects)
    .values([
      { slug: "matematicas", name: "Matematicas", emoji: "🔢", color: "#3B82F6" },
      { slug: "fisica", name: "Fisica", emoji: "⚡", color: "#10B981" },
      { slug: "ingles", name: "Ingles", emoji: "🗣", color: "#8B5CF6" },
      { slug: "quimica", name: "Quimica", emoji: "🧪", color: "#F59E0B" },
    ])
    .returning();
  console.log("📚 4 materias creadas: Matematicas, Fisica, Ingles, Quimica");

  // --- Definir modulos y nodos para las 4 materias ---
  const subjectCatalog: Record<string, {
    modules: { title: string; order: number; requiredPoints: number }[];
    nodes: { moduleIndex: number; title: string; order: number; type: "concept" | "quiz" | "challenge"; aiPromptContext: string }[];
  }> = {
    matematicas: {
      modules: [
        { title: "Aritmetica Basica", order: 1, requiredPoints: 0 },
        { title: "Fracciones y Decimales", order: 2, requiredPoints: 500 },
        { title: "Algebra Temprana", order: 3, requiredPoints: 1000 },
      ],
      nodes: [
        { moduleIndex: 0, title: "Sumas y Restas", order: 1, type: "concept", aiPromptContext: "Sumas y restas basicas de dos y tres digitos, con llevadas." },
        { moduleIndex: 0, title: "Multiplicacion", order: 2, type: "quiz", aiPromptContext: "Multiplicacion de un digito, tablas del 1 al 10, resolucion de problemas." },
        { moduleIndex: 0, title: "Divisiones Simples", order: 3, type: "quiz", aiPromptContext: "Divisiones exactas con un divisor de 1-2 digitos." },
        { moduleIndex: 0, title: "Operaciones Combinadas", order: 4, type: "challenge", aiPromptContext: "Jerarquia de operaciones: parentesis, multiplicacion, division, suma y resta." },
        { moduleIndex: 1, title: "Que es una fraccion", order: 1, type: "concept", aiPromptContext: "Numerador, denominador, fracciones propias e impropias, fracciones equivalentes." },
        { moduleIndex: 1, title: "Suma de Fracciones", order: 2, type: "quiz", aiPromptContext: "Sumas de fracciones con igual y distinto denominador." },
        { moduleIndex: 1, title: "Decimales y Porcentajes", order: 3, type: "quiz", aiPromptContext: "Conversion entre fracciones, decimales y porcentajes. Calculo de descuentos." },
        { moduleIndex: 2, title: "Introduccion al Algebra", order: 1, type: "concept", aiPromptContext: "Variables, expresiones algebraicas simples, terminos semejantes." },
        { moduleIndex: 2, title: "Ecuaciones Lineales", order: 2, type: "quiz", aiPromptContext: "Resolver ecuaciones de primer grado con una incognita." },
      ],
    },
    fisica: {
      modules: [
        { title: "Mecanica Basica", order: 1, requiredPoints: 0 },
        { title: "Energia y Ondas", order: 2, requiredPoints: 500 },
        { title: "Electricidad y Magnetismo", order: 3, requiredPoints: 1000 },
      ],
      nodes: [
        { moduleIndex: 0, title: "Las Leyes de Newton", order: 1, type: "concept", aiPromptContext: "Primera, segunda y tercera ley de Newton. Inercia, fuerza, masa y aceleracion. Ejemplos cotidianos." },
        { moduleIndex: 0, title: "Movimiento Rectilineo", order: 2, type: "quiz", aiPromptContext: "MRU y MRUV. Formulas de posicion, velocidad y aceleracion. Graficos de movimiento." },
        { moduleIndex: 0, title: "Caida Libre y Tiro", order: 3, type: "quiz", aiPromptContext: "Caida libre de objetos, gravedad (9.8 m/s2), tiro vertical. Altura maxima y tiempo de vuelo." },
        { moduleIndex: 1, title: "Energia Cinetica y Potencial", order: 1, type: "concept", aiPromptContext: "Tipos de energia: cinetica (Ec=1/2mv2) y potencial gravitatoria (Ep=mgh). Conservacion de la energia." },
        { moduleIndex: 1, title: "Calor y Temperatura", order: 2, type: "quiz", aiPromptContext: "Diferencia entre calor y temperatura. Escalas Celsius, Fahrenheit y Kelvin. Dilatacion termica." },
        { moduleIndex: 1, title: "Ondas y Sonido", order: 3, type: "quiz", aiPromptContext: "Ondas mecanicas y electromagneticas. Frecuencia, amplitud, longitud de onda. Velocidad del sonido." },
        { moduleIndex: 2, title: "Carga Electrica", order: 1, type: "concept", aiPromptContext: "Carga positiva y negativa, ley de Coulomb. Conductores y aislantes. Electricidad estatica." },
        { moduleIndex: 2, title: "Circuito Electrico", order: 2, type: "quiz", aiPromptContext: "Ley de Ohm (V=IR). Circuitos en serie y paralelo. Diferencia de potencial, corriente y resistencia." },
        { moduleIndex: 2, title: "Imanes y Magnetismo", order: 3, type: "challenge", aiPromptContext: "Polos magneticos, campo magnetico terrestre. Electroimanes y aplicaciones practicas del magnetismo." },
      ],
    },
    ingles: {
      modules: [
        { title: "Fundamentos del Ingles", order: 1, requiredPoints: 0 },
        { title: "Gramatica Intermedia", order: 2, requiredPoints: 500 },
        { title: "Conversacion y Escritura", order: 3, requiredPoints: 1000 },
      ],
      nodes: [
        { moduleIndex: 0, title: "Verbo To Be", order: 1, type: "concept", aiPromptContext: "Uso del verbo to be en presente: am, is, are. Oraciones afirmativas, negativas e interrogativas. Ej: I am a student." },
        { moduleIndex: 0, title: "Presente Simple", order: 2, type: "quiz", aiPromptContext: "Estructura del presente simple. Tercera persona (he/she/it) + s/es. Auxiliares do/does. Rutinas diarias." },
        { moduleIndex: 0, title: "Vocabulario Basico", order: 3, type: "quiz", aiPromptContext: "Numeros, colores, dias de la semana, meses, familia, partes del cuerpo, alimentos basicos." },
        { moduleIndex: 1, title: "Pasado Simple", order: 1, type: "concept", aiPromptContext: "Verbos regulares (-ed) e irregulares. Auxiliar did. Oraciones afirmativas, negativas e interrogativas en pasado." },
        { moduleIndex: 1, title: "Futuro con Will y Going To", order: 2, type: "quiz", aiPromptContext: "Uso de will para decisiones espontaneas y going to para planes. Diferencias y ejemplos practicos." },
        { moduleIndex: 1, title: "Preposiciones y Adjetivos", order: 3, type: "quiz", aiPromptContext: "Preposiciones de lugar (in, on, at, between) y tiempo. Adjetivos posesivos (my, your, his, her). Orden de adjetivos." },
        { moduleIndex: 2, title: "Presente Continuo", order: 1, type: "concept", aiPromptContext: "Estructura am/is/are + verbo-ing. Acciones en progreso ahora. Diferencia con presente simple." },
        { moduleIndex: 2, title: "Conversacion Cotidiana", order: 2, type: "quiz", aiPromptContext: "Saludos, presentaciones, pedir direcciones, ordenar en restaurante. Preguntas y respuestas comunes." },
        { moduleIndex: 2, title: "Redaccion de Oraciones", order: 3, type: "challenge", aiPromptContext: "Estructura SVO (sujeto-verbo-objeto). Construir parrafos cortos sobre rutinas, familia y hobbies." },
      ],
    },
    quimica: {
      modules: [
        { title: "Estructura de la Materia", order: 1, requiredPoints: 0 },
        { title: "Reacciones Quimicas", order: 2, requiredPoints: 500 },
        { title: "Quimica Aplicada", order: 3, requiredPoints: 1000 },
      ],
      nodes: [
        { moduleIndex: 0, title: "El Atomo", order: 1, type: "concept", aiPromptContext: "Protones, neutrones y electrones. Numero atomico (Z) y numero masico (A). Isotopos y configuracion electronica basica." },
        { moduleIndex: 0, title: "Tabla Periodica", order: 2, type: "quiz", aiPromptContext: "Grupos y periodos. Metales, no metales y metaloides. Propiedades periodicas: electronegatividad y radio atomico." },
        { moduleIndex: 0, title: "Enlaces Quimicos", order: 3, type: "quiz", aiPromptContext: "Enlace ionico (transferencia de electrones) y enlace covalente (comparticion de electrones). Ejemplos: NaCl, H2O." },
        { moduleIndex: 1, title: "Tipos de Reacciones", order: 1, type: "concept", aiPromptContext: "Sintesis, descomposicion, desplazamiento simple y doble. Reactivos y productos. Ley de conservacion de la masa." },
        { moduleIndex: 1, title: "Balanceo de Ecuaciones", order: 2, type: "quiz", aiPromptContext: "Metodo de tanteo para balancear ecuaciones quimicas. Coeficientes estequiometricos." },
        { moduleIndex: 1, title: "Acidos y Bases", order: 3, type: "quiz", aiPromptContext: "Teoria de Arrhenius. Escala de pH (0-14). Acidos y bases comunes en la vida diaria: vinagre, bicarbonato, jugos gastricos." },
        { moduleIndex: 2, title: "Estequiometria", order: 1, type: "concept", aiPromptContext: "Relaciones cuantitativas entre reactivos y productos. Masa molar y numero de Avogadro. Calculos mol a mol." },
        { moduleIndex: 2, title: "Compuestos Organicos", order: 2, type: "quiz", aiPromptContext: "Hidrocarburos (alcanos, alquenos, alquinos). Grupos funcionales basicos: alcoholes, acidos carboxilicos. Petroleo y plasticos." },
        { moduleIndex: 2, title: "Quimica en la Vida Diaria", order: 3, type: "challenge", aiPromptContext: "Reacciones cotidianas: coccion de alimentos, oxidacion de metales, fermentacion, detergentes y jabones, pilas y baterias." },
      ],
    },
  };

  const allModules: typeof schema.modules.$inferInsert[] = [];
  const allNodes: typeof schema.nodes.$inferInsert[] = [];

  for (const subj of subjects) {
    const catalog = subjectCatalog[subj.slug];
    if (!catalog) continue;

    const mods = await db
      .insert(schema.modules)
      .values(catalog.modules.map(m => ({ subjectId: subj.id, ...m })))
      .returning();
    allModules.push(...mods);

    const nodesForSubject = catalog.nodes.map(n => ({
      moduleId: mods[n.moduleIndex].id,
      title: n.title,
      order: n.order,
      type: n.type,
      aiPromptContext: n.aiPromptContext,
    }));
    const createdNodes = await db.insert(schema.nodes).values(nodesForSubject).returning();
    allNodes.push(...createdNodes);
  }
  console.log(`📚 ${allModules.length} modulos creados en 4 materias`);
  console.log(`📍 ${allNodes.length} nodos creados en 4 materias`);

  // --- Progreso simulado ---
  for (const user of users.filter((u) => u.role === "student")) {
    for (const subject of subjects) {
      await db.insert(schema.progress).values({
        userId: user.id,
        subjectId: subject.id,
        percentage: Math.floor(Math.random() * 80),
        consecutiveFailures: Math.floor(Math.random() * 4),
        daysInactive: Math.floor(Math.random() * 5),
      });
    }

    // Progreso de nodos: por cada modulo, el primer nodo desbloqueado.
    // Demo: matematicas tiene nodos 0-1 completados para mostrar estrellas.
    const allSortedNodes = await db
      .select()
      .from(schema.nodes)
      .leftJoin(schema.modules, eq(schema.nodes.moduleId, schema.modules.id))
      .orderBy(schema.modules.subjectId, schema.modules.order, schema.nodes.order);

    const seenModules = new Set<number>();
    const progressValues: { userId: number; nodeId: number; status: "locked" | "unlocked" | "completed" | "mastered"; starsEarned: number }[] = [];

    for (let i = 0; i < allSortedNodes.length; i++) {
      const node = allSortedNodes[i].nodes;
      const mod = allSortedNodes[i].modules;

      const isMathNode1or2 = mod?.subjectId === 1 && (i < 2); // matematicas first 2 nodes as demo
      const isFirstInModule = mod && !seenModules.has(mod.id);

      let status: "locked" | "unlocked" | "completed" | "mastered";
      let stars = 0;

      if (isMathNode1or2) {
        status = "completed";
        stars = Math.floor(Math.random() * 2) + 2;
      } else if (isFirstInModule) {
        status = "unlocked";
        stars = 0;
      } else {
        status = "locked";
        stars = 0;
      }

      if (mod) seenModules.add(mod.id);

      progressValues.push({
        userId: user.id,
        nodeId: node.id,
        status,
        starsEarned: stars,
      });
    }

    await db.insert(schema.userProgress).values(progressValues as any);
  }
  console.log("📊 Progreso simulado creado para cada estudiante (incluyendo Learning Path)");

  console.log("\n✅ Seed completado!");
  console.log("\n🔑 Credenciales de prueba:");
  console.log("   Estudiante: 1723456789 / PIN: 1234");
  console.log("   Docente:    1799999999 / PIN: 5678\n");
}

seed()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
