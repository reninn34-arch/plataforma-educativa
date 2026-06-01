import { NextResponse } from "next/server";

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atlas Edu API - Documentación</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #fff; }
    header { border-bottom: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb; }
    header h1 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #111827; }
    header p { margin: 4px 0 0; font-size: 0.875rem; color: #6b7280; }
    .container { padding: 24px; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { font-size: 2rem; font-weight: 700; }
    .swagger-ui .scheme { background: #f8fafc; padding: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>📚 Atlas Edu API</h1>
    <p>Documentación interactiva con Swagger UI</p>
  </header>
  <div id="swagger-ui"></div>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui@5.10.5/dist/swagger-ui.css" />
  <script src="https://unpkg.com/swagger-ui@5.10.5/dist/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui@5.10.5/dist/swagger-ui-standalone-preset.js"></script>
  <script>
    window.addEventListener("load", function () {
      SwaggerUIBundle({
        url: "/api/docs/spec",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset,
        ],
        layout: "StandaloneLayout",
        docExpansion: "list",
        persistAuthorization: true,
        tryItOutEnabled: true,
      });
    });
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}