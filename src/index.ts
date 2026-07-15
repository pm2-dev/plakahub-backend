import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRouter from "./routes/auth";
import platesRouter from "./routes/plates";
import adminRouter from "./routes/admin";
import userRouter from "./routes/user";
import chatRouter from "./routes/chat";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(helmet());

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","),
    credentials: true,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin.",
  },
});

app.use(globalLimiter);

app.use(express.json());

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/plates", platesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`PlakaHub API sunucusu ${HOST}:${PORT} portunda çalışıyor`);
});

export default app;
