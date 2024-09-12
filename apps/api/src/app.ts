require("module-alias/register");
import express, {
  json,
  NextFunction,
  Request as ExRequest,
  Response as ExResponse,
  urlencoded,
} from "express";
import swaggerUi from "swagger-ui-express";
import { ValidateError } from "tsoa";

import { logger as pino } from "@/services/logger";

import { RegisterRoutes } from "../dist/routes";

export const app = express();

const { logger } = pino;

// Use body parser to read sent json payloads
app.use(
  urlencoded({
    extended: true,
  })
);
app.use(json());
app.use(pino);

// Swagger UI setup
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.use(
  "/docs",
  swaggerUi.serve,
  async (_req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const swaggerDocument = await import("../build/swagger.json");
      res.send(swaggerUi.generateHTML(swaggerDocument));
    } catch (error) {
      next(error); // Pass the error to the next middleware
    }
  }
);

RegisterRoutes(app);

// Catch all error for URL not found
app.use(function notFoundHandler(_req, res: ExResponse) {
  res.status(404).send({
    message: "Not Found",
  });
});

// ErrorHandler for validation errors
app.use(function errorHandler(
  err: unknown,
  req: ExRequest,
  res: ExResponse,
  next: NextFunction
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
): ExResponse | void {
  if (err instanceof ValidateError) {
    logger.warn(`Caught Validation Error for ${req.path}:`, err.fields);
    return res.status(422).json({
      message: "Validation Failed",
      details: err.fields,
    });
  }
  if (err instanceof Error) {
    logger.warn(`Error: Unexpected Error for ${req.path}:`, err.message);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }

  next(err);
});
