import puppeteer from 'puppeteer';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const OUT_DIR = path.join(process.cwd(), 'public', 'docs', 'images');
const BASE_URL = 'http://localhost:3000';

async function login(page: import("puppeteer").Page, cedula: string, pin: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('#cedula', cedula);
  await page.type('#pin', pin);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

async function run() {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();

  // ─── ESTUDIANTE: Tutor IA ──────────────────────────────────────────────────
  console.log('\n📸 Capturando tutor IA del estudiante...');
  await login(page, '1723456789', '1234');
  await page.goto(`${BASE_URL}/student/dashboard`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // El chat de estudiante usa showFab=false, el trigger está en el sidebar.
  // Buscamos botón con texto "IA" o ícono Bot/Sparkles en la barra lateral.
  const openedStudent = await page.evaluate(() => {
    // Intentar cualquier botón en la sidebar que contenga IA / Sparkles / Bot
    const allBtns = Array.from(document.querySelectorAll('button, a'));
    const iaBtn = allBtns.find(el => {
      const text = (el as HTMLElement).innerText?.toLowerCase() || '';
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
      return text.includes('ia') || text.includes('asistente') || text.includes('tutor')
        || ariaLabel.includes('ia') || ariaLabel.includes('asistente') || ariaLabel.includes('tutor');
    });
    if (iaBtn) { (iaBtn as HTMLElement).click(); return true; }
    return false;
  });

  if (!openedStudent) {
    // Fallback: buscar el FAB con aria-label "Abrir asistente IA"
    console.log('  Fallback: buscando FAB...');
    await page.evaluate(() => {
      const fab = document.querySelector('[aria-label="Abrir asistente IA"]') as HTMLElement;
      if (fab) fab.click();
    });
  }

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, 'chat-tutor-ia.png'), fullPage: false });
  console.log('  ✅ chat-tutor-ia.png guardado');

  // ─── DOCENTE: Asistente IA ────────────────────────────────────────────────
  console.log('\n📸 Capturando asistente IA del docente...');
  // Clear session
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
  await page.evaluate(() => localStorage.clear());

  await login(page, '1799999999', '5678');
  await page.goto(`${BASE_URL}/teacher/dashboard`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Docente usa showFab=true — botón flotante morado en la esquina
  await page.evaluate(() => {
    const fab = document.querySelector('[aria-label="Abrir asistente IA"]') as HTMLElement;
    if (fab) fab.click();
  });

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, 'asistente-ia.png'), fullPage: false });
  console.log('  ✅ asistente-ia.png guardado');

  await browser.close();
  console.log('\n🎉 Capturas de IA completadas!');
}

run().catch(e => { console.error('❌ Error:', e); process.exit(1); });
