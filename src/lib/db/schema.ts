import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  serial,
  pgEnum,
  boolean,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "teacher", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  cedula: varchar("cedula", { length: 10 }).notNull().unique(),
  pin: varchar("pin", { length: 60 }).notNull(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  role: roleEnum("role").notNull().default("student"),
  email: varchar("email", { length: 200 }),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
});

export const progress = pgTable("progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id),
  percentage: integer("percentage").notNull().default(0),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  daysInactive: integer("days_inactive").notNull().default(0),
});

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id),
  title: varchar("title", { length: 200 }).notNull(),
  order: integer("order").notNull().default(1),
  requiredPoints: integer("required_points").notNull().default(0),
  topic: varchar("topic", { length: 200 }),
  generated: boolean("generated").notNull().default(false),
});

export const nodeTypeEnum = pgEnum("node_type", ["concept", "quiz", "challenge"]);

export const nodes = pgTable("nodes", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id")
    .notNull()
    .references(() => modules.id),
  title: varchar("title", { length: 200 }).notNull(),
  order: integer("order").notNull().default(1),
  type: nodeTypeEnum("type").notNull().default("quiz"),
  aiPromptContext: text("ai_prompt_context"),
  cachedExercises: jsonb("cached_exercises"),
}, (table) => ({
  uniqueModuleOrder: unique("nodes_module_order_unique").on(table.moduleId, table.order),
}));

export const nodeStatusEnum = pgEnum("node_status", ["locked", "unlocked", "completed", "mastered"]);

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  nodeId: integer("node_id")
    .notNull()
    .references(() => nodes.id),
  status: nodeStatusEnum("status").notNull().default("locked"),
  starsEarned: integer("stars_earned").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => chatSessions.id),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Teacher Assignments ---

export const assignmentStatusEnum = pgEnum("assignment_status", ["pending", "submitted", "graded"]);

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => users.id),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date"),
  trimester: integer("trimester").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignments.id),
  studentId: integer("student_id")
    .notNull()
    .references(() => users.id),
  content: text("content"),
  fileUrl: varchar("file_url", { length: 500 }),
  grade: integer("grade"),
  feedback: text("feedback"),
  status: assignmentStatusEnum("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// --- Practice Analytics ---

export const practiceSessions = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id),
  correctCount: integer("correct_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  score: integer("score").notNull().default(0),
  maxCombo: integer("max_combo").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const practiceAnswers = pgTable("practice_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessions.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id),
  question: text("question").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  topic: text("topic"),
  studentAnswer: text("student_answer"),
  isCorrect: boolean("is_correct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Assignment Questions (Exam / Mixed mode) ---

export const questionTypeEnum = pgEnum("question_type", ["mcq", "file_upload"]);

export const assignmentQuestions = pgTable("assignment_questions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignments.id),
  type: questionTypeEnum("type").notNull(),
  question: text("question").notNull(),
  options: jsonb("options"),           // ['A','B','C','D'] for MCQ
  correctIndex: integer("correct_index"), // 0-3 for MCQ
  points: integer("points").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
});

// --- Student answers to assignment questions ---

export const submissionAnswers = pgTable("submission_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => assignmentSubmissions.id),
  questionId: integer("question_id")
    .notNull()
    .references(() => assignmentQuestions.id),
  selectedIndex: integer("selected_index"), // for MCQ
  isCorrect: boolean("is_correct"),
});

// --- Direct Messages (Teacher-Student chat) ---

export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Admin: Configuration key-value store ---

export const configuracion = pgTable("configuracion", {
  id: serial("id").primaryKey(),
  clave: varchar("clave", { length: 100 }).notNull().unique(),
  valor: text("valor"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Admin: Courses & Enrollment ---

export const cursos = pgTable("cursos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 200 }).notNull(),
  nivel: varchar("nivel", { length: 100 }).notNull(),
  profesorId: integer("profesor_id").references(() => users.id),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cursoEstudiantes = pgTable("curso_estudiantes", {
  id: serial("id").primaryKey(),
  cursoId: integer("curso_id")
    .notNull()
    .references(() => cursos.id),
  estudianteId: integer("estudiante_id")
    .notNull()
    .references(() => users.id),
}, (table) => ({
  uniqueEnrollment: unique("curso_estudiante_unique").on(table.cursoId, table.estudianteId),
}));
