import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { initDatabase } from "./database";
import { errorHandler } from "./middleware/errorHandler";
import checkRequestsRouter from "./routes/checkRequests";
import escortsRouter from "./routes/escorts";
import nursesRouter from "./routes/nurses";
import patientsRouter from "./routes/patients";
import checkOrdersRouter from "./routes/checkOrders";
import wardsRouter from "./routes/wards";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API started" });
});

app.use("/api/check-requests", checkRequestsRouter);
app.use("/api/escorts", escortsRouter);
app.use("/api/nurses", nursesRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/check-orders", checkOrdersRouter);
app.use("/api/wards", wardsRouter);

const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

app.use(errorHandler);

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log("Server running on port", PORT);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
