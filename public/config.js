// Configuración de la instalación, leída en tiempo de ejecución (no en el build).
// En el contenedor este archivo se reemplaza al arrancar con los valores de las variables de
// entorno (ver deploy/nginx/40-config-v2.sh). Estos son los valores de desarrollo.
window.__INATRACE__ = {
  // Debe coincidir con INATrace.requestLog.token del backend (el de desarrollo es "token").
  tokenRegistro: 'token',
};
