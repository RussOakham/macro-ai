"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_http_1 = __importDefault(require("pino-http"));
const logger = (0, pino_http_1.default)({
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
        },
    },
    level: "debug",
    enabled: process.env.NODE_ENV !== "test",
});
exports.logger = logger;
