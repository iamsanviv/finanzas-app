#!/usr/bin/env bash
# Rasteriza public/icon.svg a los PNG que piden los navegadores y iOS.
# Usa el Chromium preinstalado: no hay ImageMagick ni PIL en este entorno.
#
# Va con headless_shell y no con el chrome completo: este ultimo
# descuenta ~87px de alto al viewport (--window-size=512,512 da 512x425)
# y dejaba una franja sin pintar en el borde inferior del PNG.
set -euo pipefail

CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
SRC=/home/user/finanzas-app/public/icon.svg
OUT=/home/user/finanzas-app/public
TMP="$(mktemp -d)"
cp "$SRC" "$TMP/icon.svg"

render() {         # render <tamaño> <archivo-destino> [margen-en-px]
  local size="$1" dest="$2" pad="${3:-0}"
  local inner=$(( size - pad * 2 ))
  # Fondo solido a proposito: un apple-touch-icon con canal alfa lo
  # rellena de negro iOS.
  cat > "$TMP/i.html" <<HTML
<!doctype html><meta charset="utf-8">
<style>
  *{margin:0;padding:0;border:0}
  html,body{width:${size}px;height:${size}px;background:#0E1116;overflow:hidden}
  img{position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;display:block}
</style>
<img src="icon.svg">
HTML
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size="${size},${size}" \
    --virtual-time-budget=2000 --screenshot="$dest" "$TMP/i.html" >/dev/null 2>&1
  echo "  $(basename "$dest")  ${size}x${size}$( [ "$pad" -gt 0 ] && echo "  (margen ${pad}px)" )"
}

echo "Generando iconos:"
render 180 "$OUT/apple-touch-icon.png"           # Safari iOS, pantalla de inicio
render 192 "$OUT/icon-192.png"                   # manifest / Android
render 512 "$OUT/icon-512.png"                   # manifest / splash
render 512 "$OUT/icon-maskable-512.png" 62       # Android adaptativo: ~12% de zona segura
render 32  "$OUT/favicon-32.png"        -5       # pestaña de escritorio: acercado
render 16  "$OUT/favicon-16.png"        -3       # pestaña, densidad baja: acercado

rm -rf "$TMP"
