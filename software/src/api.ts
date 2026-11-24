export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api(path: string, data?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Chasquero-Client': 'local-app' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  } catch { throw new ApiError('No se pudo conectar con el sistema. Comprueba tu conexión y vuelve a intentarlo.', 503); }
  const result = await response.json().catch(() => ({ error: 'El sistema no está disponible.' }));
  if (!response.ok) throw new ApiError(result.error || 'No se pudo completar la solicitud.', response.status);
  return result;
}
