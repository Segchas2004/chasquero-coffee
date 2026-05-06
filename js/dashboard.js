const invRef = db.collection("inventario");
const lotesRef = db.collection("lotes");

const cardsDiv = document.getElementById("dashboard-cards");
const lotesDiv = document.getElementById("dashboard-lotes");
const invDiv = document.getElementById("dashboard-inventario");
const notifDiv = document.getElementById("notificaciones");

// Resumen de inventario
async function cargarResumenInventario() {
  const snap = await invRef.get();

  let totalProductos = 0;
  let totalKg = 0;
  let sumaHumedad = 0;

  snap.forEach(doc => {
    const d = doc.data();
    totalProductos++;
    totalKg += Number(d.cantidad || 0);
    sumaHumedad += Number(d.humedad || 0);
  });

  const promHumedad = totalProductos > 0 ? (sumaHumedad / totalProductos).toFixed(2) : 0;

  invDiv.innerHTML = `
    <ul>
      <li><strong>Total de productos:</strong> ${totalProductos}</li>
      <li><strong>Peso total:</strong> ${totalKg} kg</li>
      <li><strong>Humedad promedio:</strong> ${promHumedad}%</li>
    </ul>
  `;

  cardsDiv.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h3>Inventario</h3>
      <p><strong>Productos:</strong> ${totalProductos}</p>
      <p><strong>Peso total:</strong> ${totalKg} kg</p>
      <p><strong>Humedad prom.:</strong> ${promHumedad}%</p>
    </div>
  `);
}

// Resumen de lotes
async function cargarResumenLotes() {
  const snap = await lotesRef.get();

  let totalLotes = 0;
  let totalPeso = 0;

  snap.forEach(doc => {
    const d = doc.data();
    totalLotes++;
    totalPeso += Number(d.peso || 0);
  });

  cardsDiv.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h3>Lotes</h3>
      <p><strong>Total de lotes:</strong> ${totalLotes}</p>
      <p><strong>Peso total:</strong> ${totalPeso} kg</p>
    </div>
  `);
}

// Últimos lotes
async function cargarUltimosLotes() {
  try {
    const snap = await lotesRef
      .orderBy("fecha", "desc")
      .limit(5)
      .get();

    let html = "<ul>";

    snap.forEach(doc => {
      const d = doc.data();
      html += `
        <li>
          <strong>${doc.id}</strong> — ${d.estado}, ${d.peso} kg, ${d.humedad}% — ${d.fecha}
        </li>
      `;
    });

    html += "</ul>";
    lotesDiv.innerHTML = html || "<p>No hay lotes registrados.</p>";
  } catch (err) {
    console.error(err);
    lotesDiv.innerHTML = "<p>Error al cargar los últimos lotes.</p>";
  }
}

// Indicadores de riesgo
async function cargarIndicadoresRiesgo() {
  const snapInv = await invRef.get();
  const snapLotes = await lotesRef.get();

  let productosMermaAlta = 0;
  let lotesHumedadCritica = 0;

  snapInv.forEach(doc => {
    const d = doc.data();
    if (Number(d.merma || 0) > 5) productosMermaAlta++;
  });

  snapLotes.forEach(doc => {
    const d = doc.data();
    if (Number(d.humedad || 0) > 12) lotesHumedadCritica++;
  });

  let nivel = "Bajo";
  let color = "#2ecc71";

  if (productosMermaAlta + lotesHumedadCritica >= 5) {
    nivel = "Alto";
    color = "#e74c3c";
  } else if (productosMermaAlta + lotesHumedadCritica >= 2) {
    nivel = "Medio";
    color = "#f1c40f";
  }

  cardsDiv.insertAdjacentHTML("beforeend", `
    <div class="card" style="border-left: 6px solid ${color};">
      <h3>Riesgo Operativo</h3>
      <p><strong>Nivel:</strong> ${nivel}</p>
      <p><strong>Productos con merma alta (&gt;5%):</strong> ${productosMermaAlta}</p>
      <p><strong>Lotes con humedad crítica (&gt;12%):</strong> ${lotesHumedadCritica}</p>
    </div>
  `);
}

// Notificaciones en tiempo real
lotesRef.onSnapshot((snap) => {
  notifDiv.innerHTML = "";
  snap.forEach(doc => {
    const d = doc.data();
    if (Number(d.humedad || 0) > 12) {
      notifDiv.innerHTML += `
        <div class="card" style="border-left: 6px solid #e74c3c;">
          <strong>⚠ Lote crítico:</strong> ${doc.id} — Humedad: ${d.humedad}%
        </div>
      `;
    }
  });
});

invRef.onSnapshot((snap) => {
  snap.forEach(doc => {
    const d = doc.data();
    if (Number(d.merma || 0) > 5) {
      notifDiv.innerHTML += `
        <div class="card" style="border-left: 6px solid #f1c40f;">
          <strong>⚠ Merma alta:</strong> ${doc.id} — Merma: ${d.merma}%
        </div>
      `;
    }
  });
});

// Cargar todo
(async () => {
  await cargarResumenInventario();
  await cargarResumenLotes();
  await cargarIndicadoresRiesgo();
  await cargarUltimosLotes();
})();
