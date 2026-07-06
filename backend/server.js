import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import grantCallRoutes from "./routes/grantcalls.js";
import grantCallDocRoutes from "./routes/grantcalldocs.js";
import proposalRoutes from "./routes/proposals.js";
import assessmentRoutes from "./routes/assessments.js";
import auditRoutes from "./routes/audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "proposal-eval-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/grant-calls", grantCallRoutes);
app.use("/api/grant-calls/:grantCallId/documents", grantCallDocRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/audit", auditRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Proposal Evaluation backend running on http://localhost:${PORT}`));
