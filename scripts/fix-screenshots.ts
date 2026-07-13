import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const OUT_DIR = path.join(process.cwd(), 'public', 'docs', 'images');
const BASE_URL = 'http://localhost:3000';

async function ensureDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

async function login(page: import("puppeteer").Page, cedula: string, pin: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('#cedula', cedula);
  await page.type('#pin', pin);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

async function snap(page: import("puppeteer").Page, filename: string, url: string, wait = 1500) {
  console.log(`📸 ${filename} → ${url}`);
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, wait));
  await page.screenshot({ path: path.join(OUT_DIR, `${filename}.png`), fullPage: true });
  console.log(`   ✅ guardado`);
}

async function run() {
  await ensureDir();

  // Get real IDs from the database
  const sql = postgres(process.env.DATABASE_URL!);
  const cursos = await sql`SELECT id FROM cursos ORDER BY id ASC LIMIT 1`;
  const assignments = await sql`SELECT id FROM assignments ORDER BY id ASC LIMIT 1`;
  const users = await sql`SELECT id FROM users WHERE role = 'student' ORDER BY id ASC LIMIT 1`;
  await sql.end();

  const cursoId = cursos[0]?.id ?? 1;
  const assignmentId = assignments[0]?.id ?? 1;
  const userId = users[0]?.id ?? 1;

  console.log(`IDs encontrados: curso=${cursoId}, assignment=${assignmentId}, user=${userId}`);

  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();

  // ─── ADMIN ───────────────────────────────────────────────────────────────────
  console.log('\n─── ADMIN ───');
  await login(page, '1700000000', '0000');

  // Edición de usuario — la página principal tiene modal de edición, abrirlo
  await snap(page, 'edicion-usuario', '/admin/usuarios');
  // Intentar abrir el modal de edición del primer usuario
  try {
    await page.goto(`${BASE_URL}/admin/usuarios`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    // Click the edit button of the first user row
    await page.evaluate(() => {
      const editBtns = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(el => el.querySelector('svg') || (el as HTMLElement).title?.toLowerCase().includes('editar'));
      if (editBtns.length > 0) (editBtns[0] as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUT_DIR, 'edicion-usuario.png'), fullPage: true });
    console.log('   ✅ edicion-usuario (con modal)');
  } catch(e) { console.error('   ⚠️  edicion-usuario modal error', e); }

  // Credenciales — necesita el ID del curso
  await snap(page, 'envio-credenciales', `/admin/credenciales/${cursoId}`);

  // ─── TEACHER ─────────────────────────────────────────────────────────────────
  console.log('\n─── TEACHER ───');
  // Clear session
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
  await login(page, '1799999999', '5678');

  // Formulario calificación — es la lista de assignments del docente
  await snap(page, 'formulario-calificacion', '/teacher/assignments');

  // Edición cuestionario — intentar con el primero real, si no hay, mostrar lista
  await snap(page, 'edicion-cuestionario', '/teacher/cuestionarios');

  // Material de estudio — está en la sección de cursos del docente
  await snap(page, 'creacion-material', '/teacher/cursos');

  await browser.close();
  console.log('\n🎉 Capturas corregidas exitosamente!');
}

run().catch(e => { console.error('❌ Error:', e); process.exit(1); });
