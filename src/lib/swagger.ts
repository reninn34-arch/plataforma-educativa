import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Atlas Edu API",
      version: "1.0.0",
      description: "API REST para la plataforma educativa Atlas Edu. Sistema de gestión académica con roles: estudiante, profesor, administrador y padre de familia.",
      contact: {
        name: "Soporte Atlas Edu",
      },
    },
    servers: [
      {
        url: "/api",
        description: "Servidor local de desarrollo",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT del usuario (cookie `atlas-edu-token`)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Mensaje de error" },
          },
        },
        Success: {
          type: "object",
          properties: {
            message: { type: "string", example: "Operación exitosa" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/app/api/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);