"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require('module-alias/register');
const app_1 = require("@/app");
const logger_1 = require("@/services/logger");
const { logger } = logger_1.logger;
const port = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : "3030";
app_1.app.listen(port, () => {
    logger.info(`Example app listening at http://localhost:${port}`);
});
