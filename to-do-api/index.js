const express = require("express");
const cors = require("cors");
const { createClient } = require("redis");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Configuración de Redis
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"; // <- local por default

const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls:
      redisUrl.startsWith("rediss://") || redisUrl.startsWith("redis+ssl://"),
    rejectUnauthorized: false,
  },
});
redisClient.connect().catch(console.error);

// Helper para generar IDs únicos
const getNextId = async () => {
  return await redisClient.incr("task:id:counter");
};

// POST /tasks → crear una tarea
app.post("/tasks", async (req, res) => {
  const { text } = req.body;
  if (!text)
    return res.status(400).json({ error: "Falta el texto de la tarea" });
  const id = await getNextId();
  const task = { id: id.toString(), text, done: "false" };
  await redisClient.hSet(`task:${id}`, task);
  await redisClient.rPush("tasks:ids", id.toString());
  res.status(201).json(task);
});

// GET /tasks → traer todas las tareas
app.get("/tasks", async (req, res) => {
  const ids = await redisClient.lRange("tasks:ids", 0, -1);
  const tasks = [];
  for (const id of ids) {
    const task = await redisClient.hGetAll(`task:${id}`);
    if (Object.keys(task).length > 0) tasks.push(task);
  }
  res.json(tasks);
});

// PATCH /tasks/:id → marcar como completada
app.patch("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const exists = await redisClient.exists(`task:${id}`);
  if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });
  await redisClient.hSet(`task:${id}`, "done", "true");
  const task = await redisClient.hGetAll(`task:${id}`);
  res.json(task);
});

// DELETE /tasks/:id → borrar tarea
app.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const exists = await redisClient.exists(`task:${id}`);
  if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });
  await redisClient.del(`task:${id}`);
  await redisClient.lRem("tasks:ids", 0, id);
  res.status(204).send();
});

// PATCH /tasks/:id/text → modificar el texto de una tarea
app.patch("/tasks/:id/text", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Falta el texto nuevo" });
  const exists = await redisClient.exists(`task:${id}`);
  if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });
  await redisClient.hSet(`task:${id}`, "text", text);
  const task = await redisClient.hGetAll(`task:${id}`);
  res.json(task);
});

app.listen(port, () => {
  console.log(`API To-Do List escuchando en http://localhost:${port}`);
});
