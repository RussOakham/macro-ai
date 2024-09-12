import { app } from "../app";
import { logger as pino } from "../services/logger";

const { logger } = pino;
const port = process.env.PORT ?? "3030";

app.listen(port, () => {
  logger.info(`Example app listening at http://localhost:${port}`);
});
