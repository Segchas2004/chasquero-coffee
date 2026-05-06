const lotesRef = db.collection("lotes");

const formL = document.getElementById("formLotes");
const loteIdInput = document.getElementById("loteId");
const estadoInput = document.getElementById("estado");
const pesoInput = document.getElementById("peso");
const humedadLInput = document.getElementById("humedad");
const fechaInput = document.getElementById("fecha");
const docEditIdLInput = document.getElementById("docEditId");
const btnCancelarEdicionL = document.getElementById("btnCancelarEdicion");
const listaLotesDiv = document.getElementById("lotes-list");

// Render en tiempo real
lotesRef.onSnapshot((snapshot) => {
  let html = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Estado</th>
          <th>Peso (kg)</th>
          <th>Humedad (%)</th>
          <th>Fecha</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  snapshot.forEach(doc => {
    const data = doc.data();
    html += `
      <tr>
        <td>${doc.id}</td>
        <td>${data.estado}</td>
        <td>${data.peso}</td>
        <td>${data.humedad}</td>
        <td>${data.fecha}</td>
        <td>
          <button class="btnEditar" data-id="${doc.id}">Editar</button>
          <button class="btnEliminar" data-id="${doc.id}">Eliminar</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  listaLotesDiv.innerHTML = html;

  document.querySelectorAll(".btnEditar").forEach(btn => {
    btn.addEventListener("click", () => cargarParaEditarLote(btn.dataset.id));
  });

  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", () => eliminarLote(btn.dataset.id));
  });
});

// Guardar
formL.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = loteIdInput.value.trim();
  const estado = estadoInput.value;
  const peso = Number(pesoInput.value);
  const humedad = Number(humedadLInput.value);
  const fecha = fechaInput.value;
  const editId = docEditIdLInput.value;

  if (!id) {
    alert("El ID del lote es obligatorio.");
    return;
  }

  const data = { estado, peso, humedad, fecha };

  try {
    if (editId) {
      await lotesRef.doc(editId).update(data);
      alert("Lote actualizado.");
    } else {
      await lotesRef.doc(id).set(data);
      alert("Lote agregado.");
    }
    limpiarFormularioL();
  } catch (err) {
    console.error(err);
    alert("Error al guardar: " + err.message);
  }
});

async function cargarParaEditarLote(id) {
  try {
    const doc = await lotesRef.doc(id).get();
    if (!doc.exists) {
      alert("El lote ya no existe.");
      return;
    }

    const data = doc.data();

    loteIdInput.value = id;
    loteIdInput.disabled = true;
    estadoInput.value = data.estado;
    pesoInput.value = data.peso;
    humedadLInput.value = data.humedad;
    fechaInput.value = data.fecha;

    docEditIdLInput.value = id;
    btnCancelarEdicionL.style.display = "inline-block";
  } catch (err) {
    console.error(err);
    alert("Error al cargar para editar: " + err.message);
  }
}

async function eliminarLote(id) {
  if (!confirm("¿Eliminar este lote?")) return;

  try {
    await lotesRef.doc(id).delete();
    alert("Lote eliminado.");
    if (docEditIdLInput.value === id) limpiarFormularioL();
  } catch (err) {
    console.error(err);
    alert("Error al eliminar: " + err.message);
  }
}

btnCancelarEdicionL.addEventListener("click", () => {
  limpiarFormularioL();
});

function limpiarFormularioL() {
  formL.reset();
  loteIdInput.disabled = false;
  docEditIdLInput.value = "";
  btnCancelarEdicionL.style.display = "none";
}

// Exportar a Excel
document.getElementById("btnExcel").addEventListener("click", () => {
  const tabla = document.querySelector("table").outerHTML;
  const blob = new Blob([tabla], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "lotes.xls";
  a.click();
});
