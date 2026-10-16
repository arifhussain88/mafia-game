import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";

const app: Express = express();

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors(
    corsOrigin
      ? { origin: corsOrigin, credentials: true }
      : undefined,
  ),
);

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

app.use(express.json({ verify: (req: any, _res, buf: Buffer) => { try { req.rawBody = buf && buf.toString(); } catch {} } }));
app.use(express.urlencoded({ extended: true }));

app.use((req: any, _res, next) => {
  try {
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    const hasJsonCt = ct.includes("application/json");
    const bodyEmpty = !req.body || (Object.keys(req.body).length === 0 && req.body.constructor === Object);
    if (hasJsonCt && bodyEmpty && req.rawBody) {
      const raw = String(req.rawBody || "").trim();
      if (raw) {
        try {
          req.body = JSON.parse(raw);
          return next();
        } catch (_) {
          try {
            if (raw.startsWith("{") && raw.endsWith("}")) {
              let s = raw;
              s = s.replace(/([,{]\s*)([A-Za-z0-9_@.\-]+)\s*:/g, '$1"$2":');
              s = s.replace(/:\s*([A-Za-z0-9_@.\-]+)(?=[,}\s])/g, ':"$1"');
              req.body = JSON.parse(s);
              try { logger.info({ repaired: s }, "Repaired malformed JSON payload"); } catch {}
              return next();
            }
          } catch (e2) {
            try { logger.warn({ rawBody: raw, err: String(e2 instanceof Error ? e2.message : e2) }, "Failed tolerant JSON repair"); } catch {}
          }
        }
      }
    }
  } catch (e) {
    try { logger.warn({ err: String(e instanceof Error ? e.message : e) }, "Error in JSON repair middleware"); } catch {}
  }
  return next();
});

app.use("/api/auth", authRouter);
app.use("/api", healthRouter);

app.use((err: any, req: any, res: any, next: any) => {
  if (!err) return next();
  const isBodyParser = err && (err.type === "entity.parse.failed" || err instanceof SyntaxError || err.name === "SyntaxError");
  if (isBodyParser) {
    try { logger.warn({ rawBody: req.rawBody, err: String(err?.message ?? err) }, "Invalid JSON payload received"); } catch {}
    return res.status(400).json({ message: "Invalid JSON payload" });
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
