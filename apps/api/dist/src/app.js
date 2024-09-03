"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require('module-alias/register');
const express_1 = __importStar(require("express"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const routes_1 = require("../dist/routes");
const tsoa_1 = require("tsoa");
const logger_1 = require("@/services/logger");
exports.app = (0, express_1.default)();
const { logger } = logger_1.logger;
// Use body parser to read sent json payloads
exports.app.use((0, express_1.urlencoded)({
    extended: true,
}));
exports.app.use((0, express_1.json)());
exports.app.use(logger_1.logger);
// Swagger UI setup
// eslint-disable-next-line @typescript-eslint/no-misused-promises
exports.app.use("/docs", swagger_ui_express_1.default.serve, (_req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const swaggerDocument = yield Promise.resolve().then(() => __importStar(require("../build/swagger.json")));
        res.send(swagger_ui_express_1.default.generateHTML(swaggerDocument));
    }
    catch (error) {
        next(error); // Pass the error to the next middleware
    }
}));
(0, routes_1.RegisterRoutes)(exports.app);
// Catch all error for URL not found
exports.app.use(function notFoundHandler(_req, res) {
    res.status(404).send({
        message: "Not Found",
    });
});
// ErrorHandler for validation errors
exports.app.use(function errorHandler(err, req, res, next
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) {
    if (err instanceof tsoa_1.ValidateError) {
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
