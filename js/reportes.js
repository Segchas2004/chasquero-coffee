const lotesRefR = db.collection("lotes");
const invRefR = db.collection("inventario");

const ctxPeso = document.getElementById("chartPeso").getContext("2d");
const ctxHumedad = document.getElementById("chartHumedad").getContext("2d");
const ctxComparativo = document.getElementById("chartComparativo").getContext("2d");
const resumenCriticoDiv = document.getElementById("resumenCritico");

const fDesdeInput = document.getElementById("fDesde");
const fHastaInput = document.getElementById("fHasta");
const btnFiltrar = document.getElementById("btnFiltrar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnPDF = document.getElementById("btnPDF");

let chartPeso = null;
let chartHumedad = null;
let chartComparativo = null;

async function cargarReportes(fechaDesde = null, fechaHasta = null) {
  let q = lotesRefR;
  if (fechaDesde) q = q.where("fecha", ">=", fechaDesde);
  if (fechaHasta) q = q.where("fecha", "<=", fechaHasta);

  const snapLotes = await q.get();
  const snapInv = await invRefR.get();

  let labelsLotes = [];
  let pesosLotes = [];
  let humedadesLotes = [];
  let lotesCriticos = [];

  snapLotes.forEach(doc => {
    const d = doc.data();
    labelsLotes.push(doc.id);
    const peso = Number(d.peso || 0);
    const hum = Number(d.humedad || 0);

    pesosLotes.push(peso);
    humedadesLotes.push(hum);

    if (hum > 12) {
      lotesCriticos.push({
        id: doc.id,
        estado: d.estado,
        peso,
        humedad: hum,
        fecha: d.fecha
      });
    }
  });

  let totalPesoInventario = 0;
  let productosMermaAlta = [];
  snapInv.forEach(doc => {
    const d = doc.data();
    const cant = Number(d.cantidad || 0);
    const merma = Number(d.merma || 0);
    totalPesoInventario += cant;

    if (merma > 5) {
      productosMermaAlta.push({
        id: doc.id,
        cantidad: cant,
        merma
      });
    }
  });

  const totalPesoLotes = pesosLotes.reduce((a, b) => a + b, 0);

  if (chartPeso) chartPeso.destroy();
  chartPeso = new Chart(ctxPeso, {
    type: "bar",
    data: {
      labels: labelsLotes,
      datasets: [{
        label: "Peso (kg)",
        data: pesosLotes,
        backgroundColor: "#3498db"
      }]
    }
  });

  if (chartHumedad) chartHumedad.destroy();
  chartHumedad = new Chart(ctxHumedad, {
    type: "line",
    data: {
      labels: labelsLotes,
      datasets: [{
        label: "Humedad (%)",
        data: humedadesLotes,
        borderColor: "#e67e22",
        fill: false
      }]
    }
  });

  if (chartComparativo) chartComparativo.destroy();
  chartComparativo = new Chart(ctxComparativo, {
    type: "bar",
    data: {
      labels: ["Inventario", "Lotes (filtro)"],
      datasets: [{
        label: "Peso total (kg)",
        data: [totalPesoInventario, totalPesoLotes],
        backgroundColor: ["#2ecc71", "#9b59b6"]
      }]
    }
  });

  let html = "";
  html += `<p><strong>Peso total inventario:</strong> ${totalPesoInventario} kg</p>`;
  html += `<p><strong>Peso total lotes (filtro aplicado):</strong> ${totalPesoLotes} kg</p>`;

  html += `<h3>Productos con merma alta (&gt; 5%)</h3>`;
  if (productosMermaAlta.length === 0) {
    html += `<p>No hay productos con merma alta.</p>`;
  } else {
    html += "<ul>";
    productosMermaAlta.forEach(p => {
      html += `<li><strong>${p.id}</strong> — ${p.cantidad} kg — Merma: ${p.merma}%</li>`;
    });
    html += "</ul>";
  }

  html += `<h3>Lotes con humedad crítica (&gt; 12%)</h3>`;
  if (lotesCriticos.length === 0) {
    html += `<p>No hay lotes con humedad crítica.</p>`;
  } else {
    html += "<ul>";
    lotesCriticos.forEach(l => {
      html += `<li><strong>${l.id}</strong> — ${l.estado}, ${l.peso} kg, ${l.humedad}% — ${l.fecha}</li>`;
    });
    html += "</ul>";
  }

  resumenCriticoDiv.innerHTML = html;
}

btnFiltrar.addEventListener("click", () => {
  const desde = fDesdeInput.value || null;
  const hasta = fHastaInput.value || null;
  cargarReportes(desde, hasta);
});

btnLimpiar.addEventListener("click", () => {
  fDesdeInput.value = "";
  fHastaInput.value = "";
  cargarReportes();
});

btnPDF.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  pdf.text("Reportes Avanzados - App Café", 10, 10);

  const img1 = document.getElementById("chartPeso").toDataURL("image/png");
  pdf.addImage(img1, "PNG", 10, 20, 180, 70);

  pdf.addPage();
  const img2 = document.getElementById("chartHumedad").toDataURL("image/png");
  pdf.addImage(img2, "PNG", 10, 20, 180, 70);

  pdf.addPage();
  const img3 = document.getElementById("chartComparativo").toDataURL("image/png");
  pdf.addImage(img3, "PNG", 10, 20, 180, 70);

  pdf.addPage();
  pdf.text("Resumen crítico:", 10, 10);
  const resumenTexto = resumenCriticoDiv.innerText || "";
  const lineas = pdf.splitTextToSize(resumenTexto, 180);
  pdf.text(lineas, 10, 20);

  pdf.save("Reportes_Avanzados_AppCafe.pdf");
});

cargarReportes();
