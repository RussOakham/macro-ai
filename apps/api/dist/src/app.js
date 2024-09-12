var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express, { json, urlencoded, } from "express";
import swaggerUi from "swagger-ui-express";
import { ValidateError } from "tsoa";
import { RegisterRoutes } from "../dist/routes";
import { logger as pino } from "./services/logger";
export const app = express();
const { logger } = pino;
// Use body parser to read sent json payloads
app.use(urlencoded({
    extended: true,
}));
app.use(json());
app.use(pino);
// Swagger UI setup
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.use("/docs", swaggerUi.serve, (_req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const swaggerDocument = yield import("../build/swagger.json");
        res.send(swaggerUi.generateHTML(swaggerDocument));
    }
    catch (error) {
        next(error); // Pass the error to the next middleware
    }
}));
RegisterRoutes(app);
// Catch all error for URL not found
app.use(function notFoundHandler(_req, res) {
    res.status(404).send({
        message: "Not Found",
    });
});
// ErrorHandler for validation errors
app.use(function errorHandler(err, req, res, next
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) {
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
