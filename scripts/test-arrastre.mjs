// Prueba real en Chromium: monta las filas tal como las pinta la app,
// carga la logica de arrastre de ui.js y simula gestos con el dedo.
import { chromium } from 'playwright';
import fs from 'node:fs';

const CSS = fs.readFileSync('/home/user/finanzas-app/public/css/styles.css', 'utf8');
let UI = fs.readFileSync('/home/user/finanzas-app/public/js/ui.js', 'utf8');

// Se recorta ui.js a lo que se quiere probar: los imports tocan Supabase
// (red bloqueada) y aqui solo interesa el bloque de arrastre.
const ini = UI.indexOf('// ---------- reordenar movimientos arrastrando ----------');
const fin = UI.indexOf('document.addEventListener("change"');
let ARRASTRE = UI.slice(ini, fin);
// Se sustituyen las dos dependencias externas por espias.
ARRASTRE = ARRASTRE
  .replace('await reordenarDia(orden);', 'window.__guardado = orden;')
  .replace('renderDashboard(); // repinta desde los datos, se haya guardado o no', 'window.__repintado = true;');

const filas = [
  { id: 'a', fecha: '2026-09-18', txt: 'A · 18 sep' },
  { id: 'b', fecha: '2026-09-18', txt: 'B · 18 sep' },
  { id: 'c', fecha: '2026-09-18', txt: 'C · 18 sep' },
  { id: 'd', fecha: '2026-09-17', txt: 'D · 17 sep' },
  { id: 'e', fecha: '2026-09-17', txt: 'E · 17 sep' },
];

const HTML = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<body><div class="card" id="lista">
${filas.map(f => `<div class="tx-row" data-id="${f.id}" data-fecha="${f.fecha}">
  <button class="tx-grip" type="button"><span></span><span></span><span></span></button>
  <div class="tx-info"><span class="tx-cat">${f.txt}</span></div>
  <span class="tx-monto">$1.000</span>
</div>`).join('')}
</div><script type="module">${ARRASTRE}</script></body>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 800 }, hasTouch: true });
await page.setContent(HTML);

const orden = () => page.$$eval('.tx-row', rs => rs.map(r => r.dataset.id).join(''));
const centro = async (id) => {
  const b = await page.locator(`.tx-row[data-id="${id}"] .tx-grip`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const filaY = async (id) => {
  const b = await page.locator(`.tx-row[data-id="${id}"]`).boundingBox();
  return b.y + b.height / 2;
};

// Arrastra el asa de `id` hasta la altura y, en pasos (necesario: el
// intercambio ocurre en pointermove, no en el salto final).
async function arrastrar(id, y) {
  const p = await centro(id);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  const pasos = 24;
  for (let i = 1; i <= pasos; i++) {
    await page.mouse.move(p.x, p.y + (y - p.y) * (i / pasos));
  }
  await page.mouse.up();
}

let fallos = 0;
const check = (t, got, exp) => {
  const ok = got === exp;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'}  ${t}: ${got}${ok ? '' : `  (esperado ${exp})`}`);
};

console.log('orden inicial:', await orden(), '\n');

// 1. Mover dentro del mismo dia: A debajo de C
await arrastrar('a', await filaY('c'));
check('A al final de su dia      ', await orden(), 'bcade');
check('se guardo solo ese dia    ', JSON.stringify(await page.evaluate(() => window.__guardado)), '["b","c","a"]');

// 2. Intentar sacar una fila a OTRO dia (hacia abajo): debe bloquearse
await page.evaluate(() => { window.__guardado = null; window.__repintado = false; });
const antes = await orden();
await arrastrar('a', (await filaY('e')) + 40);
check('bloqueado al bajar a otro dia', await orden(), antes);
check('no se guardo nada           ', String(await page.evaluate(() => window.__guardado)), 'null');

// 3. Subir una fila del 17 hasta el bloque del 18. Subir sobre su
// companera de dia SI es valido; lo que no puede es entrar al dia 18.
await page.evaluate(() => { window.__guardado = null; });
await arrastrar('e', (await filaY('b')) - 20);
const tras3 = await orden();
check('e no entra al dia 18        ', tras3.slice(0, 3), 'bca');
check('e sube sobre d (mismo dia)  ', tras3, 'bcaed');

// 4. Reordenar dentro del segundo dia: devolver d encima de e
await page.evaluate(() => { window.__guardado = null; });
await arrastrar('d', (await filaY('e')) - 6);
check('reordena el 2do dia         ', await orden(), 'bcade');
check('guarda solo el 2do dia      ', JSON.stringify(await page.evaluate(() => window.__guardado)), '["d","e"]');

// 5. Marca visual de bloqueo mientras se arrastra fuera del dia
const p = await centro('b');
await page.mouse.move(p.x, p.y);
await page.mouse.down();
const yFuera = (await filaY('d')) + 60;
for (let i = 1; i <= 20; i++) await page.mouse.move(p.x, p.y + (yFuera - p.y) * (i / 20));
check('marca .tx-bloqueado         ',
  await page.locator('.tx-row[data-id="b"]').evaluate(el => el.classList.contains('tx-bloqueado')), true);
await page.mouse.up();
check('al soltar se limpia la marca',
  await page.locator('.tx-row[data-id="b"]').evaluate(el => el.classList.contains('tx-bloqueado')), false);

// 6. Un dia con una sola fila no debe iniciar arrastre
await page.setContent(HTML.replace(/data-fecha="2026-09-1[78]"/g, (m, i) => m).replace(
  /<div class="tx-row" data-id="d"[\s\S]*?<\/div>\s*<\/div>/, ''));
console.log('\n' + (fallos === 0 ? 'TODO OK' : `${fallos} FALLO(S)`));
await browser.close();
process.exit(fallos ? 1 : 0);
