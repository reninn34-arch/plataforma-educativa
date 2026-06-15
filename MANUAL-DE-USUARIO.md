# Manual de Usuario — Atlas Edu

Plataforma Educativa Inteligente para el Programa de Currículo para Educación Intensiva (PCEI) de Ecuador.

---

## Índice

1. [Introducción](#1-introducción)
2. [Primeros Pasos](#2-primeros-pasos)
3. [Portal del Estudiante](#3-portal-del-estudiante)
4. [Portal del Docente](#4-portal-del-docente)
5. [Portal del Administrador](#5-portal-del-administrador)
6. [Preguntas Frecuentes](#6-preguntas-frecuentes)
7. [Soporte Técnico](#7-soporte-técnico)

---

## 1. Introducción

### ¿Qué es Atlas Edu?

Atlas Edu es una plataforma educativa integral diseñada para el **Programa de Currículo para Educación Intensiva (PCEI)** de Ecuador. Su objetivo es acelerar la educación secundaria de adultos mediante el uso de herramientas con inteligencia artificial, gamificación, seguimiento de progreso y comunicación fluida entre estudiantes, docentes y administradores.

![Logotipo de Atlas Edu con el eslogan "Educación Inteligente para el Futuro".](/docs/images/logotipo.png)

### ¿A quién está dirigido?

| Rol | Descripción |
|-----|-------------|
| **Estudiante** | Personas inscritas en el programa PCEI que cursan materias como Matemáticas, Física, Inglés y Química. |
| **Docente** | Profesores encargados de guiar, evaluar y acompañar a los estudiantes en su proceso de aprendizaje. |
| **Administrador** | Personal encargado de gestionar usuarios, cursos, periodos lectivos y la configuración general del sistema. |

### Requisitos Técnicos

- **Navegador:** Google Chrome 90+, Mozilla Firefox 88+, Microsoft Edge 90+, Safari 14+ (versiones modernas con soporte de JavaScript y CSS Grid).
- **Conexión a Internet:** Mínimo 2 Mbps (recomendado 5 Mbps para funcionalidades de IA).
- **Dispositivo:** Computadora de escritorio, laptop, tablet o smartphone con acceso a internet.
- **Cuenta de correo electrónico:** Necesaria para recuperación de PIN y notificaciones.

---

## 2. Primeros Pasos

### 2.1. Acceso a la Plataforma

Abra su navegador web y diríjase a la dirección proporcionada por su institución (ej: `https://atlas.edu.ec`).

![Pantalla de carga inicial de Atlas Edu con el logotipo y animación.](/docs/images/carga-inicial.png)

### 2.2. Inicio de Sesión

1. En la página principal, haga clic en el botón **"Iniciar Sesión"**.
2. Ingrese su **cédula de identidad** (10 dígitos, sin guiones ni espacios).
3. Ingrese su **PIN de 4 dígitos** proporcionado por la institución.
4. Haga clic en el botón **"Ingresar"**.

![Captura de pantalla del formulario de inicio de sesión con los campos de cédula y PIN visibles.](/docs/images/login.png)

**Nota:** Si ingresa un PIN incorrecto en múltiples ocasiones, el sistema bloqueará temporalmente el acceso por razones de seguridad.

### 2.3. Recuperación de PIN

Si ha olvidado su PIN:

1. En la página de inicio de sesión, haga clic en el enlace **"¿Olvidaste tu PIN?"**.
2. Ingrese su **cédula de identidad** y la **dirección de correo electrónico** registrada en el sistema.
3. Haga clic en **"Enviar enlace de recuperación"**.
4. Revise su bandeja de correo electrónico (incluyendo la carpeta de spam).
5. Abra el enlace recibido (válido por 15 minutos).
6. Ingrese un **nuevo PIN de 4 dígitos**.
7. Confirme el nuevo PIN y haga clic en **"Restablecer PIN"**.

![Formulario de recuperación de PIN con los campos de cédula y correo electrónico.](/docs/images/recuperacion-pin.png)

### 2.4. Interfaz General

Una vez dentro de la plataforma, verá los siguientes elementos comunes:

| Elemento | Descripción |
|----------|-------------|
| **Barra lateral (Sidebar)** | Menú de navegación principal con acceso a todas las secciones según su rol. |
| **Barra superior (Topbar)** | Contiene el nombre del usuario, botón de notificaciones y selector de tema. |
| **Selector de Tema** | Permite alternar entre tema **Claro**, **Oscuro** o **Sistema** (sigue la configuración de su dispositivo). |

![Vista general del dashboard con la barra lateral, la barra superior y el contenido principal anotados.](/docs/images/dashboard-general.png)

### 2.5. Cierre de Sesión

Para cerrar sesión de forma segura:
1. Haga clic en su nombre en la esquina superior derecha.
2. Seleccione **"Cerrar Sesión"**.

![Menú desplegable con la opción "Cerrar Sesión" resaltada.](/docs/images/menu-cerrar-sesion.png)

---

## 3. Portal del Estudiante

### 3.1. Dashboard (Panel Principal)

Al iniciar sesión como estudiante, el dashboard le muestra un resumen general de su progreso académico:

- **Progreso General:** Porcentaje de avance en sus materias.
- **Racha de Días (Streak):** Días consecutivos de actividad en la plataforma.
- **Precisión General:** Porcentaje de respuestas correctas en prácticas con IA.
- **Sesiones de Práctica:** Total de sesiones realizadas.
- **Tareas Pendientes:** Lista de tareas próximas a vencer con un contador regresivo.
- **Acceso Rápido:** Botones para iniciar práctica con IA o hablar con el tutor IA.

![Dashboard del estudiante con tarjetas de métricas, acceso rápido y lista de tareas pendientes.](/docs/images/dashboard-estudiante.png)

### 3.2. Camino de Aprendizaje

El **Camino de Aprendizaje** es una representación visual de los módulos y nodos que debe completar en cada materia.

1. Desde el menú lateral, seleccione **"Camino de Aprendizaje"**.
2. Elija la materia que desea cursar (Matemáticas, Física, Inglés o Química).
3. Visualice los **módulos** (unidades temáticas) y dentro de ellos los **nodos** (lecciones individuales).
4. Los nodos pueden tener los siguientes estados:
   - **🔒 Bloqueado** — Debe completar el nodo anterior para acceder.
   - **🔓 Desbloqueado** — Disponible para comenzar.
   - **✅ Completado** — Ha sido superado exitosamente.
   - **🏆 Dominado** — Ha alcanzado el nivel más alto (con estrellas).

![Vista del camino de aprendizaje de una materia con módulos y nodos en diferentes estados.](/docs/images/camino-aprendizaje.png)

### 3.3. Práctica con IA (Gamificada)

Al hacer clic en un nodo desbloqueado, ingresa a la práctica interactiva gamificada:

#### Elementos de la Práctica

| Elemento | Descripción |
|----------|-------------|
| **❤️ Vidas (Hearts)** | Comienza con 3 vidas. Pierde una vida por cada respuesta incorrecta. Al perder todas, la práctica termina. |
| **⏱️ Temporizador** | Cuenta regresiva por pregunta. Si el tiempo se acaba, se cuenta como incorrecta. |
| **🔥 Combo** | Cadena de respuestas correctas consecutivas. A mayor combo, más puntos por respuesta. |
| **⭐ Puntos** | Puntuación acumulada basada en respuestas correctas y combo. |
| **📊 Barra de Progreso** | Muestra cuántas preguntas ha respondido del total. |

#### Tipos de Ejercicios

- **Opción Múltiple:** Seleccione la respuesta correcta entre varias opciones.
- **Verdadero/Falso:** Determine si la afirmación es correcta o incorrecta.
- **Completar:** Escriba la palabra o número que falta.
- **Relacionar:** Empareje elementos de dos columnas.

#### Funcionalidades Adicionales

- **🎯 Diagramas:** Al finalizar, el IA genera un diagrama explicativo del tema (Mermaid).
- **📺 Videos Relacionados:** El sistema sugiere videos de YouTube relevantes al tema.
- **🎉 Confetti:** Animación de celebración al completar un nodo exitosamente.

![Pantalla de práctica activa mostrando una pregunta, las vidas restantes, el combo y el temporizador.](/docs/images/practica-activa.png)

### 3.4. Tutor IA (Chat por Materia)

El **Tutor IA** es un asistente conversacional que responde preguntas sobre la materia seleccionada.

1. Desde el menú lateral, seleccione **"Tutor IA"**.
2. Elija la materia sobre la que desea consultar.
3. Escriba su pregunta en el campo de texto y presione **Enter** o haga clic en **"Enviar"**.
4. El tutor le responderá con explicaciones paso a paso, ejemplos y aclaraciones.

**Consejo:** El tutor está diseñado para **guiarle sin dar la respuesta directa**. Hará preguntas para ayudarle a llegar a la solución por sí mismo.

![Ventana del chat del Tutor IA con un historial de preguntas y respuestas visible.](/docs/images/chat-tutor-ia.png)

### 3.5. Tareas

#### Ver Tareas Pendientes

1. En el menú lateral, seleccione **"Tareas"**.
2. Visualice la lista de tareas asignadas con los siguientes datos:
   - Título de la tarea
   - Materia
   - Fecha de entrega
   - Estado (Pendiente, Entregada, Calificada)
   - Calificación (si ya fue evaluada)

#### Entregar una Tarea

1. Haga clic en la tarea que desea entregar.
2. Redacte su respuesta en el campo de texto o adjunte un archivo (PDF, Word, imagen, etc.).
3. Haga clic en **"Entregar Tarea"**.

![Detalle de una tarea con el campo de respuesta, el selector de archivos y el botón de entrega.](/docs/images/detalle-tarea.png)

### 3.6. Cuestionarios de Estudio

Los cuestionarios son evaluaciones tipo opción múltiple creadas por sus docentes.

1. Seleccione **"Cuestionarios"** en el menú lateral.
2. Elija el cuestionario que desea resolver.
3. Responda cada pregunta seleccionando una opción.
4. Al finalizar, haga clic en **"Enviar Respuestas"**.
5. El sistema le mostrará su puntuación y las respuestas correctas de forma inmediata.

**Exportar:** Puede descargar el cuestionario en formato PDF haciendo clic en el ícono de descarga.

![Cuestionario en curso con preguntas de opción múltiple y botón de envío.](/docs/images/cuestionario-curso.png)

### 3.7. Horario

Visualice su horario semanal de clases:

1. Seleccione **"Horario"** en el menú lateral.
2. Vea los bloques de clase organizados por día y hora.
3. Cada bloque muestra la materia y el aula correspondiente.

![Vista del horario semanal con bloques de colores por materia.](/docs/images/estudiante-horario.png)

### 3.8. Calendario

El calendario le muestra todas las fechas importantes:

- Fechas de entrega de tareas
- Eventos académicos
- Inicio y fin de periodos lectivos

1. Seleccione **"Calendario"** en el menú lateral.
2. Navegue entre meses usando las flechas izquierda/derecha.
3. Haga clic en un evento para ver los detalles.

![Vista del calendario mensual con eventos marcados.](/docs/images/estudiante-calendario.png)

### 3.9. Calificaciones

Consulte su historial de calificaciones:

1. Seleccione **"Calificaciones"** en el menú lateral.
2. Visualice una tabla con las siguientes columnas:
   - Materia
   - Tipo de evaluación (tarea, cuestionario, examen)
   - Calificación obtenida
   - Fecha
3. En la parte superior, vea su **promedio general** y el **promedio por materia**.

![Tabla de calificaciones con el promedio general destacado.](/docs/images/estudiante-calificaciones.png)

### 3.10. Perfil

Desde su perfil puede:

1. **Cambiar su nombre:** Actualice su nombre completo (si el administrador lo permite).
2. **Cambiar su PIN:**
   - Ingrese su PIN actual.
   - Ingrese el nuevo PIN (4 dígitos).
   - Confirme el nuevo PIN.
   - Haga clic en **"Guardar Cambios"**.
3. **Cambiar tema:** Seleccione entre tema claro, oscuro o automático.

![Página de perfil con los formularios de cambio de nombre y PIN.](/docs/images/perfil.png)

### 3.11. Notificaciones

El ícono de **campana 🔔** en la barra superior muestra las notificaciones no leídas.

- Haga clic en la campana para ver la lista de notificaciones.
- Las notificaciones incluyen: nuevas tareas, tareas próximas a vencer, calificaciones publicadas, mensajes de docentes.
- Haga clic en una notificación para ir directamente a la sección correspondiente.

![Panel desplegable de notificaciones con ejemplos de notificaciones.](/docs/images/notificaciones.png)

---

## 4. Portal del Docente

### 4.1. Dashboard (Panel Principal)

Al iniciar sesión como docente, el dashboard le muestra:

- **Selector de Curso:** Elija el curso que desea visualizar.
- **Tabla de Estudiantes:** Lista de estudiantes con sus métricas:
  - Nombre completo
  - Progreso general
  - Precisión en prácticas IA
  - Tareas entregadas / total
  - Última actividad
  - Estado de riesgo (si aplica)
- **Exportar Datos:** Botón para descargar la tabla en Excel o CSV.

![Dashboard del docente con la tabla de estudiantes y el selector de curso.](/docs/images/dashboard-docente.png)

### 4.2. Gestión de Cursos

1. Seleccione **"Mis Cursos"** en el menú lateral.
2. Visualice la lista de cursos que tiene asignados.
3. Haga clic en un curso para ver:
   - Estudiantes matriculados
   - Materias que imparte en ese curso
   - Acceso rápido a tareas, asistencia y horario

![Vista de la lista de cursos asignados al docente.](/docs/images/cursos-docente.png)

### 4.3. Tareas

#### Crear una Nueva Tarea

**Método Manual:**
1. Seleccione **"Tareas"** en el menú lateral.
2. Haga clic en **"Nueva Tarea"**.
3. Complete los campos:
   - **Curso:** Seleccione el curso destino.
   - **Materia:** Seleccione la materia.
   - **Título:** Nombre de la tarea.
   - **Descripción:** Instrucciones detalladas.
   - **Fecha de Entrega:** Fecha y hora límite.
   - **Trimestre:** Seleccione el trimestre correspondiente.
   - **Archivo (opcional):** Adjunte un archivo de apoyo.
4. Haga clic en **"Crear Tarea"**.

**Método con IA:**
1. Haga clic en **"Generar con IA"**.
2. Describa brevemente el tema de la tarea.
3. Seleccione el tipo de preguntas (opción múltiple, completar, etc.).
4. Revise el resultado generado y ajústelo si es necesario.
5. Haga clic en **"Crear Tarea"**.

#### Calificar Entregas

1. Seleccione una tarea de la lista.
2. Vea las entregas de los estudiantes en una tabla.
3. Haga clic en **"Calificar"** junto a la entrega del estudiante.
4. Ingrese la calificación y un comentario de retroalimentación.
5. Haga clic en **"Guardar Calificación"**.

![Formulario de calificación con campo de nota y retroalimentación.](/docs/images/formulario-calificacion.png)

### 4.4. Cuestionarios

#### Crear un Cuestionario

**Método Manual:**
1. Seleccione **"Cuestionarios"** en el menú lateral.
2. Haga clic en **"Nuevo Cuestionario"**.
3. Complete:
   - **Título y descripción**
   - **Curso y materia**
   - **Trimestre**
4. Agregue preguntas una por una:
   - Seleccione el tipo (opción múltiple, archivo, completar)
   - Escriba la pregunta y las opciones
   - Indique la respuesta correcta
   - Asigne el puntaje
5. Haga clic en **"Guardar Cuestionario"**.

**Método con IA:**
1. Haga clic en **"Generar con IA"**.
2. Describa el tema y la cantidad de preguntas deseadas.
3. Revise y edite las preguntas generadas.
4. Guarde el cuestionario.

#### Exportar Cuestionario

- Desde la vista del cuestionario, haga clic en **"Exportar PDF"** o **"Exportar Word"**.
- El archivo descargado incluirá todas las preguntas, formateadas para impresión.

![Vista de edición de un cuestionario con lista de preguntas y botones de exportación.](/docs/images/edicion-cuestionario.png)

### 4.5. Asistencia

#### Registrar Asistencia

1. Seleccione **"Asistencia"** en el menú lateral.
2. Seleccione el **curso** y la **fecha**.
3. Verá la lista de estudiantes con un selector de estado para cada uno:
   - **Presente** ✅
   - **Ausente** ❌
   - **Atrasado** ⏰
4. Haga clic en **"Guardar Asistencia"**.

#### Consultar Asistencia

- Use el selector de fechas para ver el historial de asistencia de un curso.
- Los datos se muestran en una tabla con los estudiantes en filas y las fechas en columnas.

![Tabla de registro de asistencia con los estados por estudiante.](/docs/images/registro-asistencia.png)

### 4.6. Horario

Configure los bloques horarios de sus cursos:

1. Seleccione **"Horario"** en el menú lateral.
2. Seleccione el **curso**.
3. Para cada día de la semana, agregue bloques con:
   - Hora de inicio y fin
   - Materia
4. Haga clic en **"Guardar Horario"**.

![Editor de horario semanal con bloques por día y materia.](/docs/images/docente-horario.png)

### 4.7. Analíticas IA

Consulte el rendimiento de sus estudiantes en las prácticas con inteligencia artificial:

1. Seleccione **"Analíticas IA"** en el menú lateral.
2. Seleccione el **curso** y la **materia**.
3. Visualice los siguientes indicadores por estudiante:
   - **Sesiones realizadas**
   - **Precisión promedio**
   - **Combo máximo alcanzado**
   - **Nodos completados vs. totales**
   - **Estudiantes en riesgo** (baja actividad o precisión)

![Panel de analíticas con gráficos y tabla de rendimiento por estudiante.](/docs/images/analiticas-docente.png)

### 4.8. Gradebook (Libro de Calificaciones)

1. Seleccione **"Gradebook"** en el menú lateral.
2. Seleccione el **curso** y el **trimestre**.
3. Visualice una matriz con:
   - Estudiantes en filas
   - Evaluaciones (tareas, cuestionarios) en columnas
   - Notas y promedio general
4. **Exportar:** Haga clic en **"Exportar"** y elija el formato:
   - Excel (.xlsx)
   - CSV (.csv)
   - PDF (.pdf)

![Vista del gradebook con la matriz de estudiantes y evaluaciones.](/docs/images/gradebook.png)

### 4.9. Material de Estudio

Gestione el contenido educativo de sus cursos:

1. Seleccione **"Material de Estudio"** en el menú lateral.
2. Haga clic en **"Nuevo Material"**.
3. Complete:
   - **Título**
   - **Curso y materia**
   - **Contenido** (puede incluir texto formateado, imágenes, enlaces)
   - **Tipo de archivo** (si aplica)
4. Haga clic en **"Guardar"**.

![Formulario de creación de material de estudio.](/docs/images/creacion-material.png)

### 4.10. Mensajería

#### Enviar Mensaje a un Estudiante

1. Haga clic en el ícono de **mensaje** junto al nombre del estudiante en cualquier tabla.
2. Redacte su mensaje.
3. Haga clic en **"Enviar"**.

#### Enviar Mensaje a un Curso

1. Seleccione **"Mensajes"** en el menú lateral.
2. Seleccione **"Enviar a Curso"**.
3. Elija el curso destino.
4. Redacte el mensaje.
5. Haga clic en **"Enviar a Todos"**.

![Ventana de mensajería con selección de destinatario y campo de texto.](/docs/images/mensajeria.png)

### 4.11. Asistente IA (Acciones Rápidas)

El asistente IA flotante (ícono ✨ en la esquina inferior derecha) le permite realizar acciones mediante comandos de voz o texto:

- "Crear una tarea de Matemáticas sobre ecuaciones"
- "¿Qué estudiantes están en riesgo en mi curso?"
- "Enviar un mensaje a todos los estudiantes de 1ro BGU"
- "Generar un cuestionario de Física con 10 preguntas"

![Asistente IA flotante abierto mostrando comandos de ejemplo.](/docs/images/asistente-ia.png)

---

## 5. Portal del Administrador

### 5.1. Dashboard (Panel Principal)

Al iniciar sesión como administrador, el dashboard le muestra:

- **Gráfico de Usuarios por Rol:** Diagrama circular (pie chart) con la distribución de estudiantes, docentes y administradores.
- **Usuarios Activos vs. Inactivos:** Gráfico de barras comparativo.
- **Estudiantes por Curso:** Gráfico de barras con la cantidad de estudiantes en cada curso.
- **Acceso Rápido:** Botones para ir a Gestión de Usuarios y Gestión de Cursos.

![Dashboard del administrador con los gráficos y accesos rápidos.](/docs/images/dashboard-admin.png)

### 5.2. Gestión de Usuarios

#### Ver Lista de Usuarios

1. Seleccione **"Usuarios"** en el menú lateral.
2. Visualice la tabla con todos los usuarios del sistema:
   - Cédula, nombre, correo, rol, estado (activo/inactivo), última sesión.
3. Use el **buscador** para filtrar por nombre o cédula.

#### Crear un Usuario

1. Haga clic en **"Nuevo Usuario"**.
2. Complete los campos obligatorios:
   - **Cédula** (10 dígitos)
   - **Nombres completos**
   - **Correo electrónico**
   - **Rol** (estudiante, docente, administrador)
   - **PIN** (4 dígitos, se genera automáticamente si no se especifica)
3. Haga clic en **"Guardar"**.

#### Carga Masiva (CSV)

1. Haga clic en **"Importar CSV"**.
2. Descargue la **plantilla CSV** con el formato requerido.
3. Complete los datos de los usuarios en el archivo CSV.
4. Seleccione el archivo y haga clic en **"Subir"**.
5. Revise el resumen de usuarios a crear y confirme.

#### Editar / Desactivar Usuario

1. Haga clic en el nombre del usuario en la tabla.
2. Puede:
   - Editar nombre y correo
   - Cambiar el rol
   - **Activar o desactivar** el usuario (un usuario desactivado no puede iniciar sesión)
3. Haga clic en **"Guardar Cambios"**.

![Formulario de creación/edición de usuario con todos los campos.](/docs/images/edicion-usuario.png)

### 5.3. Gestión de Cursos

#### Crear un Curso

1. Seleccione **"Cursos"** en el menú lateral.
2. Haga clic en **"Nuevo Curso"**.
3. Complete:
   - **Nombre del curso**
   - **Nivel**
   - Haga clic en **"Guardar"**.

#### Ver Detalle del Curso

Haga clic en un curso para acceder a:

- **Estudiantes:** Lista de estudiantes matriculados. Puede agregar o retirar estudiantes.
- **Profesores:** Asignación de profesores por materia. Cada materia puede tener un profesor distinto.
- **Horarios:** Configuración de bloques horarios por día y materia.
- **Enviar Credenciales:** Botón para enviar por correo electrónico las credenciales (cédula y PIN) a todos los estudiantes del curso.

#### Matricular Estudiantes

1. Desde el detalle del curso, vaya a la sección **"Estudiantes"**.
2. Haga clic en **"Agregar Estudiantes"**.
3. Busque estudiantes por nombre o cédula.
4. Seleccione los estudiantes a matricular.
5. Haga clic en **"Matricular"**.

![Detalle del curso con pestañas de estudiantes, profesores y horarios.](/docs/images/detalle-curso.png)

### 5.4. Periodos Lectivos

Gestione los periodos académicos:

1. Seleccione **"Periodos Lectivos"** en el menú lateral.
2. Haga clic en **"Nuevo Periodo"**.
3. Complete:
   - **Nombre del periodo** (ej: "Periodo 2026 - 2027")
   - **Fecha de inicio**
   - **Fecha de fin**
   - **Activo** (marcar como periodo vigente)
4. Haga clic en **"Guardar"**.

**Nota:** Solo un periodo lectivo puede estar **activo** a la vez. Al activar un nuevo periodo, el anterior se desactivará automáticamente.

![Lista de periodos lectivos con indicador de periodo activo.](/docs/images/periodos-lectivos.png)

### 5.5. Configuración SMTP

Configure el servidor de correo para el envío de credenciales y notificaciones:

1. Seleccione **"Configuración"** en el menú lateral.
2. Complete los campos del servidor SMTP:
   - **Servidor** (ej: smtp.gmail.com)
   - **Puerto** (ej: 587)
   - **Usuario**
   - **Contraseña**
   - **Nombre del remitente**
3. Haga clic en **"Guardar Configuración"**.
4. Para probar la configuración, haga clic en **"Enviar Correo de Prueba"** e ingrese una dirección de correo destino.

![Formulario de configuración SMTP con botón de prueba.](/docs/images/configuracion-smtp.png)

### 5.6. Envío de Credenciales

#### Enviar a un Usuario Individual

1. Vaya al detalle del usuario.
2. Haga clic en **"Enviar Credenciales"**.
3. El sistema enviará un correo con la cédula y el PIN del usuario.

#### Enviar a Todo un Curso

1. Vaya al detalle del curso.
2. Haga clic en **"Enviar Credenciales"** en la sección correspondiente.
3. Confirme el envío masivo.

![Confirmación de envío de credenciales con resumen de destinatarios.](/docs/images/envio-credenciales.png)

### 5.7. Reportes

1. Seleccione **"Reportes"** en el menú lateral.
2. Visualice estadísticas globales del sistema:
   - Total de usuarios por rol
   - Total de cursos activos
   - Estudiantes por curso
   - Actividad reciente
3. Puede exportar los reportes en formato PDF o Excel.

![Página de reportes con gráficos y tablas estadísticas.](/docs/images/reportes-admin.png)


---

## 6. Preguntas Frecuentes

### 6.1. Olvidé mi PIN / No puedo iniciar sesión

**P:** ¿Cómo recupero mi PIN?
**R:** En la página de inicio de sesión, haga clic en "¿Olvidaste tu PIN?" y siga las instrucciones. Recibirá un enlace en su correo electrónico para restablecerlo.

**P:** Mi PIN ha sido bloqueado por muchos intentos fallidos.
**R:** Espere 15 minutos e intente nuevamente. Si el problema persiste, contacte a su administrador.

### 6.2. No veo mis cursos/materias

**P:** Ingresé a la plataforma pero no veo ningún curso.
**R:** Como estudiante, debe estar matriculado en un curso por parte del administrador. Contacte a su administrador para verificar su matriculación.

**P:** Como docente, no veo los cursos que debería impartir.
**R:** Verifique con el administrador que tenga asignados los cursos y materias correctas en el sistema.

### 6.3. La práctica con IA no funciona

**P:** La práctica con IA se queda cargando o no genera ejercicios.
**R:** Verifique su conexión a internet. Si el problema persiste, puede deberse a una configuración del proveedor de IA. Contacte a su administrador.

**P:** Las preguntas generadas no son relevantes al tema.
**R:** Intente refrescar la práctica. Si el problema continúa, informe a su docente para que ajuste el contexto del nodo.

### 6.4. Cómo exportar calificaciones

**P:** Como docente, ¿cómo descargo las calificaciones de mi curso?
**R:** Vaya a "Gradebook" en el menú lateral, seleccione el curso y trimestre, y haga clic en "Exportar". Puede elegir entre Excel, CSV o PDF.

**P:** Como estudiante, ¿puedo descargar mis calificaciones?
**R:** Sí, en la sección "Calificaciones" puede ver su historial. Use la función de impresión del navegador (Ctrl+P) para guardar como PDF.

### 6.5. Cómo cambiar mi tema (claro/oscuro)

**P:** ¿Cómo cambio entre tema claro y oscuro?
**R:** Haga clic en el ícono de **sol/luna** en la barra superior derecha. Puede elegir entre "Claro", "Oscuro" o "Sistema" (sigue la configuración de su dispositivo).

### 6.6. Problemas con la entrega de tareas

**P:** Intenté entregar una tarea pero el archivo no se sube.
**R:** Verifique que el archivo no supere el tamaño máximo permitido (generalmente 10 MB). Formatos aceptados: PDF, DOC, DOCX, JPG, PNG, ZIP.

**P:** Entregué la tarea pero sigue apareciendo como "Pendiente".
**R:** Refresque la página. Si el estado no cambia, contacte a su docente.

### 6.7. No recibo correos del sistema

**P:** Solicité la recuperación de PIN pero no me llegó el correo.
**R:** Revise la carpeta de **Spam/Correo no deseado**. Si no aparece, verifique que su correo esté correctamente registrado contactando al administrador.

---

## 7. Soporte Técnico

### Contacto

Si experimenta problemas técnicos que no pueden ser resueltos con esta guía:

- **Administrador del Sistema:** Contacte al administrador de su institución.
- **Soporte Técnico Atlas Edu:** Envíe un correo a la dirección de soporte proporcionada por su institución.

### Recomendaciones Generales

| Situación | Recomendación |
|-----------|---------------|
| **Página no carga correctamente** | Limpie la caché del navegador (Ctrl+Shift+Delete en Chrome) y recargue la página. |
| **Error al iniciar sesión** | Verifique que la cédula tenga 10 dígitos sin guiones. Asegúrese de que el PIN sea correcto. |
| **La plataforma se ve desordenada** | Actualice su navegador a la última versión disponible. |
| **Problemas de rendimiento** | Cierre otras pestañas y aplicaciones. Verifique su conexión a internet. |
| **Las funcionalidades de IA no responden** | Espere unos segundos y vuelva a intentarlo. Si persiste, contacte al administrador. |

### Requisitos Mínimos del Sistema

- **Navegador:** Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- **Conexión:** 2 Mbps mínimo (5 Mbps recomendado)
- **JavaScript:** Debe estar habilitado en el navegador
- **Cookies:** Deben estar habilitadas para mantener la sesión activa

---

> **Documento generado el:** Junio 2026
>
> **Versión de la plataforma:** Atlas Edu 1.0
>
> **Nota:** Las imágenes sugeridas en este manual son referencias visuales. Consulte con su institución para obtener capturas de pantalla reales de la plataforma.
