const express = require("express");
const cors = require("cors");
const { createClient } = require("redis");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------------------
// Configuración Redis
// ---------------------

// Variables de entorno opcionales:
// LOCAL: redis://localhost:6379
// CLOUD: redis://default:<password>@host:port
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"; // <- tu Redis local por default

const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls:
      redisUrl.startsWith("rediss://") || redisUrl.startsWith("redis+ssl://"),
    rejectUnauthorized: false, // necesario para Redis Cloud con SSL
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.on("connect", () => console.log("Conectado a Redis!"));
redisClient.on("ready", () => console.log("Redis listo para operaciones"));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("No se pudo conectar a Redis:", err);
  }
})();

// ---------------------
// Helpers
// ---------------------

const getNextId = async () => {
  return await redisClient.incr("task:id:counter");
};

// ---------------------
// Endpoints
// ---------------------

// Crear tarea
app.post("/tasks", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text)
      return res.status(400).json({ error: "Falta el texto de la tarea" });

    const id = await getNextId();
    const task = { id: id.toString(), text, done: "false" };

    await redisClient.hSet(`task:${id}`, task);
    await redisClient.rPush("tasks:ids", id.toString());

    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando la tarea" });
  }
});

// Traer todas las tareas
app.get("/tasks", async (req, res) => {
  try {
    const ids = await redisClient.lRange("tasks:ids", 0, -1);
    const tasks = [];

    for (const id of ids) {
      const task = await redisClient.hGetAll(`task:${id}`);
      if (Object.keys(task).length > 0) tasks.push(task);
    }

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo tareas" });
  }
});

// Marcar tarea como completada
app.patch("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await redisClient.exists(`task:${id}`);
    if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });

    await redisClient.hSet(`task:${id}`, "done", "true");
    const task = await redisClient.hGetAll(`task:${id}`);
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando tarea" });
  }
});

// Borrar tarea
app.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await redisClient.exists(`task:${id}`);
    if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });

    await redisClient.del(`task:${id}`);
    await redisClient.lRem("tasks:ids", 0, id);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error borrando tarea" });
  }
});

// Modificar texto de tarea
app.patch("/tasks/:id/text", async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Falta el texto nuevo" });

    const exists = await redisClient.exists(`task:${id}`);
    if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });

    await redisClient.hSet(`task:${id}`, "text", text);
    const task = await redisClient.hGetAll(`task:${id}`);
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando texto de tarea" });
  }
});

// ---------------------
// Start server
// ---------------------

app.listen(port, () => {
  console.log(`API To-Do List escuchando en http://localhost:${port}`);
});
