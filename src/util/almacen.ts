// localStorage puede no estar (navegación privada estricta, bloqueos): nunca debe romper la app.
export function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
export function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: se usa el valor por defecto en la próxima visita */
  }
}
