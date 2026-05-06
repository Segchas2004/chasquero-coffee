const inventarioRef = db.collection("inventario");

const form = document.getElementById("formInventario");
const prodIdInput = document.getElementById("prodId");
const cantidadInput = document.getElementById("cantidad");
const humedadInput = document.getElementById("humedad");
const mermaInput = document.getElementById("merma");
const docEditIdInput = document.getElementById("docEditId");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const listaDiv = document.getElementById("inventario-list");

// Render en tiempo real
inventarioRef.onSnapshot((snapshot) => {
  let html = `
    <table>
      <thead>
        <tr>
          <th>Código / Nombre</th>
          <th>Cantidad (kg)</th>
          <th>Humedad (%)</th>
          <th>Merma (%)</th>
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
        <td>${data.cantidad}</td>
        <td>${data.humedad}</td>
        <td>${data.merma}</td>
        <td>
          <button class="btnEditar" data-id="${doc.id}">Editar</button>
          <button class="btnEliminar" data-id="${doc.id}">Eliminar</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  listaDiv.innerHTML = html;

  document.querySelectorAll(".btnEditar").forEach(btn => {
    btn.addEventListener("click", () => cargarParaEditar(btn.dataset.id));
  });

  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", () => eliminarProducto(btn.dataset.id));
  });
});

// Guardar
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = prodIdInput.value.trim();
  const cantidadIngresada = Number(cantidadInput.value);
  const humedad = Number(humedadInput.value);
  const merma = Number(mermaInput.value);
  const editId = docEditIdInput.value;

  if (!id) {
    alert("El código/nombre es obligatorio.");
    return;
  }

  try {
    // Si estamos editando → reemplazar valores
    if (editId) {
      await inventarioRef.doc(editId).update({
        cantidad: cantidadIngresada,
        humedad,
        merma
      });
      alert("Producto actualizado.");
      limpiarFormulario();
      return;
    }

    // Si NO estamos editando → SUMAR al inventario
    const doc = await inventarioRef.doc(id).get();

    let cantidadFinal = cantidadIngresada;

    if (doc.exists) {
      const dataActual = doc.data();
      const cantidadActual = Number(dataActual.cantidad || 0);
      cantidadFinal = cantidadActual + cantidadIngresada;
    }

    await inventarioRef.doc(id).set({
      cantidad: cantidadFinal,
      humedad,
      merma
    });

    alert("Producto agregado / cantidad sumada.");
    limpiarFormulario();

  } catch (err) {
    console.error(err);
    alert("Error al guardar: " + err.message);
  }
});


async function cargarParaEditar(id) {
  try {
    const doc = await inventarioRef.doc(id).get();
    if (!doc.exists) {
      alert("El producto ya no existe.");
      return;
    }

    const data = doc.data();

    prodIdInput.value = id;
    prodIdInput.disabled = true;
    cantidadInput.value = data.cantidad;
    humedadInput.value = data.humedad;
    mermaInput.value = data.merma;
    docEditIdInput.value = id;
    btnCancelarEdicion.style.display = "inline-block";
  } catch (err) {
    console.error(err);
    alert("Error al cargar para editar: " + err.message);
  }
}

async function eliminarProducto(id) {
  if (!confirm("¿Eliminar este producto del inventario?")) return;

  try {
    await inventarioRef.doc(id).delete();
    alert("Producto eliminado.");
    if (docEditIdInput.value === id) limpiarFormulario();
  } catch (err) {
    console.error(err);
    alert("Error al eliminar: " + err.message);
  }
}

btnCancelarEdicion.addEventListener("click", () => {
  limpiarFormulario();
});

function limpiarFormulario() {
  form.reset();
  prodIdInput.disabled = false;
  docEditIdInput.value = "";
  btnCancelarEdicion.style.display = "none";
}

// Exportar a Excel
document.getElementById("btnExcel").addEventListener("click", () => {
  const tabla = document.querySelector("table").outerHTML;
  const blob = new Blob([tabla], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "inventario.xls";
  a.click();
});
