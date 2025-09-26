import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import passwordResetRoutes from "./routes/passwordReset.js";
import { connectDB } from "./config/db.js";
dotenv.config();

const PORT = process.env.PORT || 8080;

const app = express();
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || "http://localhost:3000";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json());

app.use("/api/users", authRoutes);
app.use("/api/auth", passwordResetRoutes);

connectDB();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started at port ${PORT}`);
});
