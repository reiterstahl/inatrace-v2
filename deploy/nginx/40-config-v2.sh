#!/bin/sh
# Escribe la configuración de la instalación que lee la v2 en tiempo de ejecución.
# Se ejecuta al arrancar el contenedor (docker-entrypoint.d de la imagen de nginx).
set -eu
escapar() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
cat > /tmp/config-v2.js <<JS
window.__INATRACE__ = {
  tokenRegistro: "$(escapar "${TOKEN_REGISTRO_PUBLICO:-}")",
  urlPublica: "$(escapar "${APP_BASE_URL:-}")",
  rutaQr: "$(escapar "${QR_CODE_BASE_PATH:-q-cd}")"
};
JS
echo "config-v2: configuración escrita"
