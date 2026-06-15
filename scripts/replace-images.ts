import fs from 'fs';
import path from 'path';

const manualPath = path.join(process.cwd(), 'MANUAL-DE-USUARIO.md');
let content = fs.readFileSync(manualPath, 'utf8');

const imageNames = [
  'logotipo',
  'carga-inicial',
  'login',
  'recuperacion-pin',
  'dashboard-general',
  'menu-cerrar-sesion',
  'dashboard-estudiante',
  'camino-aprendizaje',
  'practica-activa',
  'chat-tutor-ia',
  'detalle-tarea',
  'cuestionario-curso',
  'estudiante-horario',
  'estudiante-calendario',
  'estudiante-calificaciones',
  'perfil',
  'notificaciones',
  'dashboard-docente',
  'cursos-docente',
  'formulario-calificacion',
  'edicion-cuestionario',
  'registro-asistencia',
  'docente-horario',
  'analiticas-docente',
  'gradebook',
  'creacion-material',
  'mensajeria',
  'asistente-ia',
  'dashboard-admin',
  'edicion-usuario',
  'detalle-curso',
  'periodos-lectivos',
  'configuracion-smtp',
  'envio-credenciales',
  'reportes-admin',
  'boletin-calificaciones'
];

let index = 0;
content = content.replace(/> \*\*Imagen sugerida:\*\* (.*?)$/gm, (match, desc) => {
  if (index < imageNames.length) {
    const filename = imageNames[index];
    index++;
    return `![${desc.trim()}](/docs/images/${filename}.png)`;
  }
  return match;
});

fs.writeFileSync(manualPath, content, 'utf8');
console.log(`Replaced ${index} images in MANUAL-DE-USUARIO.md`);
