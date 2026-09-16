import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
// capture raw body for debugging JSON parse issues
app.use(express.json({ verify: (req: any, _res, buf: Buffer) => { try { req.rawBody = buf && buf.toString(); } catch {} } }));
app.use(express.urlencoded({ extended: true }));

// Repair malformed JSON from rawBody (if body-parser failed) before routing
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
          // attempt tolerant repair: quote keys and unquoted string values
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
            try { logger.warn({ rawBody: raw, err: String(e2?.message ?? e2) }, "Failed tolerant JSON repair"); } catch {}
          }
        }
      }
    }
  } catch (e) {
    try { logger.warn({ err: String(e?.message ?? e) }, "Error in JSON repair middleware"); } catch {}
  }
  return next();
});

app.use("/api/auth", authRouter);
app.use("/api", healthRouter);

// Debug: list registered routes for /api (inspect authRouter and healthRouter)
try {
  const routes: string[] = [];
  [authRouter, healthRouter].forEach((r: any) => {
    r?.stack?.forEach((layer: any) => {
      if (layer.route) {
        const path = layer.route?.path;
        const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
        routes.push(`${methods} ${path}`);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        layer.handle.stack.forEach((l: any) => {
          if (l.route) {
            const path = l.route?.path;
            const methods = Object.keys(l.route.methods).join(",").toUpperCase();
            routes.push(`${methods} ${path}`);
          }
        });
      }
    });
  });
  try { logger.info({ routes }, 'Registered /api routes (direct)'); } catch {}
} catch (e) { try { logger.warn({ err: String(e) }, 'Failed to list routes (direct)'); } catch {} }

// JSON parse / syntax error handler (returns JSON instead of HTML) — logs and returns 400
app.use((err: any, req: any, res: any, next: any) => {
  if (!err) return next();
  const isBodyParser = err && (err.type === "entity.parse.failed" || err instanceof SyntaxError || err.name === 'SyntaxError');
  if (isBodyParser) {
    try { logger.warn({ rawBody: req.rawBody, err: String(err?.message ?? err) }, "Invalid JSON payload received"); } catch {}
    // try reparsing here (error handler path) and hand off to router when successful
    if (req && req.rawBody) {
      try {
        // try strict parse first
        req.body = JSON.parse(req.rawBody);
        try { logger.info({}, "Reparsed rawBody in error handler"); } catch {}
        return router(req, res, (nextErr: any) => next(nextErr));
      } catch (_) {
        try {
          const raw = String(req.rawBody || "").trim();
          if (raw.startsWith("{") && raw.endsWith("}")) {
            let s = raw;
            s = s.replace(/([,{]\s*)([A-Za-z0-9_@.\-]+)\s*:/g, '$1"$2":');
            s = s.replace(/:\s*([A-Za-z0-9_@.\-]+)(?=[,}\s])/g, ':"$1"');
            req.body = JSON.parse(s);
            try { logger.info({ repaired: s }, "Repaired malformed JSON payload in error handler"); } catch {}
            return router(req, res, (nextErr: any) => next(nextErr));
          }
        } catch (e2) {
          try { logger.warn({ rawBody: req.rawBody, err: String(e2?.message ?? e2) }, "Failed tolerant repair in error handler"); } catch {}
        }
      }
    }
    return res.status(400).json({ message: "Invalid JSON payload" });
  }
  return next(err);
});

export default app;
