var _a;
import { app } from "../app";
import { logger as pino } from "../services/logger";
const { logger } = pino;
const port = (_a = process.env.PORT) !== null && _a !== void 0 ? _a : "3030";
app.listen(port, () => {
    logger.info(`Example app listening at http://localhost:${port}`);
});
