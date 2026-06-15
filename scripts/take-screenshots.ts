import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'public', 'docs', 'images');
const BASE_URL = 'http://localhost:3000';

async function ensureDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

async function login(page: any, cedula: string, pin: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('#cedula', cedula);
  await page.type('#pin', pin);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

async function logout(page: any) {
  // Simple hack to clear cookies/localstorage
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
  await page.evaluate(() => localStorage.clear());
}

async function takeScreenshot(page: any, pathName: string, url: string, preAction?: (page: any) => Promise<void>) {
  console.log(`Navigating to ${url} for ${pathName}...`);
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle0' });
  
  if (preAction) {
    await preAction(page);
    await new Promise(r => setTimeout(r, 1000)); // allow animations
  }

  const filePath = path.join(OUT_DIR, `${pathName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Saved ${pathName}.png`);
}

async function run() {
  await ensureDir();
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();

  // --- No auth / Generic ---
  await takeScreenshot(page, 'logotipo', '/login'); // Logotipo is on the login page
  await takeScreenshot(page, 'carga-inicial', '/login'); 
  await takeScreenshot(page, 'login', '/login');

  console.log('Testing forgot pin...');
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Olvidaste'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT_DIR, 'recuperacion-pin.png'), fullPage: true });
  
  // --- STUDENT ---
  console.log('--- Logging in as STUDENT ---');
  await login(page, '1723456789', '1234');
  
  await takeScreenshot(page, 'dashboard-general', '/student/dashboard');
  
  try {
    await page.goto(`${BASE_URL}/student/dashboard`);
    await page.evaluate(() => {
      const headerBtns = Array.from(document.querySelectorAll('header button, header div[role="button"]'));
      if (headerBtns.length > 0) {
         (headerBtns[headerBtns.length - 1] as HTMLElement).click();
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, 'menu-cerrar-sesion.png'), fullPage: true });
  } catch(e) { console.error('menu error', e); }
  
  await takeScreenshot(page, 'dashboard-estudiante', '/student/dashboard');
  await takeScreenshot(page, 'camino-aprendizaje', '/student/path/matematicas');
  await takeScreenshot(page, 'practica-activa', '/student/practice');
  await takeScreenshot(page, 'chat-tutor-ia', '/student/path/matematicas'); // assuming chat widget is here
  await takeScreenshot(page, 'detalle-tarea', '/student/assignments/1');
  await takeScreenshot(page, 'cuestionario-curso', '/student/cuestionarios/1');
  await takeScreenshot(page, 'estudiante-horario', '/student/horario');
  await takeScreenshot(page, 'estudiante-calendario', '/student/calendar');
  await takeScreenshot(page, 'estudiante-calificaciones', '/student/grades');
  await takeScreenshot(page, 'perfil', '/student/profile');
  
  try {
    await page.goto(`${BASE_URL}/student/dashboard`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button, header div[role="button"]'));
      if (btns.length >= 2) (btns[btns.length - 2] as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, 'notificaciones.png') });
  } catch(e) { console.error('notif error', e); }

  await logout(page);

  // --- TEACHER ---
  console.log('--- Logging in as TEACHER ---');
  await login(page, '1799999999', '5678');
  await takeScreenshot(page, 'dashboard-docente', '/teacher/dashboard');
  await takeScreenshot(page, 'cursos-docente', '/teacher/cursos');
  await takeScreenshot(page, 'formulario-calificacion', '/teacher/assignments/1');
  await takeScreenshot(page, 'edicion-cuestionario', '/teacher/cuestionarios/1/edit');
  await takeScreenshot(page, 'registro-asistencia', '/teacher/asistencia');
  await takeScreenshot(page, 'docente-horario', '/teacher/horario');
  await takeScreenshot(page, 'analiticas-docente', '/teacher/analytics');
  await takeScreenshot(page, 'gradebook', '/teacher/grades');
  await takeScreenshot(page, 'creacion-material', '/teacher/cursos/1/materials/new');
  await takeScreenshot(page, 'mensajeria', '/teacher/dashboard'); // Just generic dashboard for messaging if no route
  await takeScreenshot(page, 'asistente-ia', '/teacher/dashboard'); // Generic

  await logout(page);

  // --- ADMIN ---
  console.log('--- Logging in as ADMIN ---');
  await login(page, '1700000000', '0000');
  await takeScreenshot(page, 'dashboard-admin', '/admin/dashboard');
  await takeScreenshot(page, 'edicion-usuario', '/admin/usuarios/new');
  await takeScreenshot(page, 'detalle-curso', '/admin/cursos/1');
  await takeScreenshot(page, 'periodos-lectivos', '/admin/periodos');
  await takeScreenshot(page, 'configuracion-smtp', '/admin/configuracion');
  await takeScreenshot(page, 'envio-credenciales', '/admin/credenciales');
  await takeScreenshot(page, 'reportes-admin', '/admin/reportes');


  await browser.close();
  console.log('All screenshots taken!');
}

run().catch(console.error);
