document.addEventListener("DOMContentLoaded", () => {
  const menuHTML = `
    <nav class="menu">
      <ul>
        <li><a href="dashboard.html">Dashboard</a></li>
        <li><a href="inventario.html">Inventario</a></li>
        <li><a href="lotes.html">Lotes</a></li>
        <li><a href="reportes.html">Reportes</a></li>
        <li><a href="config.html">Configuración</a></li>
        <li><button id="btnDarkMode" class="dark-btn">Modo oscuro</button></li>
        <li><button id="btnLogout" class="logout-btn">Cerrar sesión</button></li>
      </ul>
    </nav>
  `;

  document.body.insertAdjacentHTML("afterbegin", menuHTML);

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      auth.signOut().then(() => {
        window.location.href = "login.html";
      });
    });
  }

  const darkBtn = document.getElementById("btnDarkMode");
  if (darkBtn) {
    darkBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
    });
  }
});
