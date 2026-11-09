import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import adminRouter from "./routes/admin";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";

const app: Express = express();

// Caddy reverse-proxies from 127.0.0.1, so trust only the loopback hop.
// req.ip is then the real client IP and X-Forwarded-For cannot be spoofed by clients.
app.set("trust proxy", "loopback");
app.disable("x-powered-by");

// The web client is served from this same origin; only enable CORS when an
// explicit origin is configured (e.g. a separate frontend host).
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  app.use(cors({ origin: corsOrigin.split(",").map((o) => o.trim()), credentials: true }));
}

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", healthRouter);

app.use((err: any, req: any, res: any, next: any) => {
  if (!err) return next();
  const isBodyParser = err && (err.type === "entity.parse.failed" || err.type === "entity.too.large" || err instanceof SyntaxError || err.name === "SyntaxError");
  if (isBodyParser) {
    // Never log the body: it can contain passwords.
    logger.warn({ path: req.path }, "Invalid JSON payload received");
    return res.status(err.type === "entity.too.large" ? 413 : 400).json({ message: "Invalid request body" });
  }
  return next(err);
});

function resolveStaticDir() {
  if (process.env.STATIC_DIR) return process.env.STATIC_DIR;
  const candidates = [
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "..", "public"),
    path.resolve(import.meta.dirname, "..", "..", "game-lobby", "dist", "public"),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) ?? null;
}

const staticDir = resolveStaticDir();
if (staticDir) {
  logger.info({ staticDir }, "Serving static frontend");
  app.use(express.static(staticDir, {
    index: false,
    setHeaders(res, filePath) {
      if (/\.(webp|png|jpe?g|svg|woff2?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=604800");
      }
    },
  }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    const indexHtml = path.join(staticDir, "index.html");
    if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
    return next();
  });
}

export default app;
