import pino from "pino-http";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
  level: "debug",
  enabled: process.env.NODE_ENV !== "test",
});

export { logger };
