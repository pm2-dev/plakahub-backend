import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import platesRouter from "./routes/plates";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/plates", platesRouter);

app.listen(PORT, () => {
  console.log(`PlakaHub API sunucusu ${PORT} portunda çalışıyor`);
});

export default app;
