import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("met_vault.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS collections (
    user_id INTEGER PRIMARY KEY,
    data TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/register", (req, res) => {
    const { email, password } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
      const result = stmt.run(email, password);
      const token = Buffer.from(`${email}:${result.lastInsertRowid}`).toString("base64");
      res.json({ token, email });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      const token = Buffer.from(`${email}:${user.id}`).toString("base64");
      res.json({ token, email });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Collection Routes
  app.get("/api/collections", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    const [email, id] = Buffer.from(token, "base64").toString().split(":");
    const row = db.prepare("SELECT data FROM collections WHERE user_id = ?").get(id) as any;
    res.json({ collections: row ? JSON.parse(row.data) : {} });
  });

  app.post("/api/sync", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    const [email, id] = Buffer.from(token, "base64").toString().split(":");
    const { collections } = req.body;
    
    db.prepare("INSERT OR REPLACE INTO collections (user_id, data) VALUES (?, ?)").run(id, JSON.stringify(collections));
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!process.env.GEMINI_API_KEY) {
      console.warn("WARNING: GEMINI_API_KEY is not set in the environment.");
    } else {
      console.log("GEMINI_API_KEY is present.");
    }
  });
}

startServer();
