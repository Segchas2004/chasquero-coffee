// Ejecutar con credenciales locales de Google, nunca desde el navegador.
process.env.CHASQUERO_ENV = 'production';
const { auth, db } = await import('../server/firebase.mjs');
const { emptyState } = await import('../server/domain.mjs');
const email = process.env.CHASQUERO_ADMIN_EMAIL;
const name = process.env.CHASQUERO_ADMIN_NAME || 'Administración Chasquero';
if (!email) throw new Error('Define CHASQUERO_ADMIN_EMAIL con el correo del usuario creado en Firebase Authentication.');
const user = await auth.getUserByEmail(email);
await db.runTransaction(async tx => {
  const users = await tx.get(db.collection('users'));
  if (!users.empty) throw new Error('Ya existen usuarios; utiliza Usuarios y permisos en el sistema.');
  tx.set(db.doc('users/' + user.uid), { id:user.uid, name, email:user.email, role:'administrador', area:'general', active:true });
  tx.set(db.doc('settings/company'), { ...emptyState().settings, demo:false });
});
console.log('Primer administrador habilitado. No se cargaron operaciones ni cuentas de demostración.');
