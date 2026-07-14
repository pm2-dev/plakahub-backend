import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRouter from "./routes/auth";
import platesRouter from "./routes/plates";
import adminRouter from "./routes/admin";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/plates", platesRouter);
app.use("/api/admin", adminRouter);

app.listen(PORT, () => {
  console.log(`PlakaHub API sunucusu ${PORT} portunda çalışıyor`);
});

export default app;
