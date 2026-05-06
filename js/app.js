document.getElementById("btnLogin").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Buscar rol en Firestore
    const usuariosRef = db.collection("usuarios");
    const query = await usuariosRef.where("email", "==", email).get();

    if (query.empty) {
      alert("Usuario sin rol asignado.");
      return;
    }

    const data = query.docs[0].data();
    const rol = data.rol;

    // Redirección según rol
    if (rol === "gerente") {
      window.location.href = "inventario.html";
    } 
    else if (rol === "administrador") {
      window.location.href = "config.html";
    } 
    else if (rol === "analista") {
      window.location.href = "reportes.html";
    } 
    else {
      alert("Rol no reconocido.");
    }

  } catch (error) {
    alert("Error: " + error.message);
  }
});
