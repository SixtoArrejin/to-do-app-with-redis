async function editTask(id, newText) {
  await fetch(`${API_URL}/${id}/text`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: newText }),
  });
}
const API_URL = "http://localhost:3000/tasks";

async function fetchTasks() {
  const res = await fetch(API_URL);
  return res.json();
}

async function addTask(text) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

async function deleteTask(id) {
  await fetch(`${API_URL}/${id}`, { method: "DELETE" });
}

async function markDone(id) {
  await fetch(`${API_URL}/${id}`, { method: "PATCH" });
}

function renderTasks(tasks) {
  const list = document.getElementById("taskList");
  list.innerHTML = "";
  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = task.done === "true" ? "done" : "";
    const span = document.createElement("span");
    span.textContent = task.text;
    li.appendChild(span);

    if (task.done !== "true") {
      // Botón editar
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.title = "Editar texto";
      editBtn.onclick = () => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = task.text;
        input.style.flex = "1";
        const saveBtn = document.createElement("button");
        saveBtn.textContent = "💾";
        saveBtn.title = "Guardar";
        saveBtn.onclick = async () => {
          const newText = input.value.trim();
          if (newText && newText !== task.text) {
            await editTask(task.id, newText);
            loadTasks();
          } else {
            renderTasks(tasks);
          }
        };
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "✖";
        cancelBtn.title = "Cancelar";
        cancelBtn.onclick = () => renderTasks(tasks);
        li.innerHTML = "";
        li.appendChild(input);
        li.appendChild(saveBtn);
        li.appendChild(cancelBtn);
        input.focus();
      };
      li.appendChild(editBtn);

      // Botón marcar como hecha
      const doneBtn = document.createElement("button");
      doneBtn.textContent = "✔";
      doneBtn.title = "Marcar como hecha";
      doneBtn.onclick = async () => {
        await markDone(task.id);
        loadTasks();
      };
      li.appendChild(doneBtn);
    }

    // Botón eliminar
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑";
    delBtn.title = "Eliminar";
    delBtn.onclick = async () => {
      await deleteTask(task.id);
      loadTasks();
    };
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

async function loadTasks() {
  const tasks = await fetchTasks();
  renderTasks(tasks);
}

document.getElementById("addForm").onsubmit = async (e) => {
  e.preventDefault();
  const input = document.getElementById("newTask");
  const text = input.value.trim();
  if (text) {
    await addTask(text);
    input.value = "";
    loadTasks();
  }
};

loadTasks();
