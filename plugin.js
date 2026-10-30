// =============================================================================
// CRS DESIGN SYSTEM GENERATOR, plugin de Penpot (v1.12, raíz del repositorio)
//
// QUÉ CAMBIA RESPECTO A v6 Y v7:
//   La v6 y la v7 maquetaban con POSICIONAMIENTO ABSOLUTO: cada texto y cada
//   filete se agregaba al board y después se le asignaban x e y. En el runtime
//   real de Penpot eso producía boards SIN CONTENIDO VISIBLE (sin error en la
//   consola del plugin). La v5, que sí dibuja (5 páginas, 111 componentes,
//   19 colores y 8 tipografías), maqueta al revés: cada contenedor es un board
//   con FLEX LAYOUT y los hijos se agregan con appendChild EN ORDEN, sin
//   coordenadas.
//
//   La v8 abandona por completo el posicionamiento absoluto y reproduce el
//   diseño de la v6 (portada e índice) con el patrón de la v5:
//     createBoard() + resize(1280, alto) + fills + addFlexLayout()
//     y luego appendChild en orden. Los espaciados se resuelven con gap,
//     padding y contenedores anidados (filas con dir 'row' y
//     justifyContent 'space-between'). NINGÚN hijo de un board recibe x ni y.
//
// QUÉ GENERA:
//   00 Portada -> barra superior (nombre del sistema y etiqueta de versión),
//                 símbolo ">" grande en azul, "CRS DISEÑO" en mayúsculas con
//                 tracking, filete de acento, línea de rol, subtítulo del
//                 documento y pie con fecha y "DOCUMENTO INTERNO".
//   01 Índice  -> titular ÍNDICE, "CONTENIDO DE LA PRESENTACIÓN" y una fila
//                 por sección con número, viñeta ">", título, frase corta y
//                 filete separador. Las filas se leen de la tabla SECTIONS,
//                 así que el índice nunca se desincroniza; la portada y el
//                 índice no se listan a sí mismos.
//
// TIPOGRAFÍA (regla de marca cerrada):
//   La ÚNICA familia aplicada a texto es Plus Jakarta Sans (pesos 700 y 800 en
//   titulares, mayúsculas y letterSpacing amplio). Bank Gothic MD BT queda
//   reservada al logotipo oficial, que es un SVG, y NO se aplica a ningún
//   texto generado; solo puede aparecer nombrada en comentarios como este.
//
// REGLAS DE API VALIDADAS EN VIVO (no cambiar):
//   - Global `penpot` (no api.penpot); `penpot.ui.open(nombre, '')`.
//   - El UI manda texto plano 'crs-generate'.
//   - width/height de las formas son de SOLO LECTURA: `shape.resize(w, h)`.
//   - `fills`, `strokes`, `shadows` son PROPIEDADES, no métodos.
//   - El texto se configura con propiedades directas (fontFamily, fontSize en
//     string, fontWeight, letterSpacing, textTransform, align, growType); el
//     color va en `fills`.
//   - `addFlexLayout()` SIN argumentos; luego se ajustan sus propiedades.
//   - `library.local.createColor()` y `createTypography()` sin argumentos.
//   - `safeName()` en todo nombre: Penpot rechaza cadenas vacías.
//   - manifest con "version": 2 (esquema del manifest, no versión del plugin).
//
// MARCA: esquinas 100% rectas (radio 0); círculos solo de énfasis (aquí no se
// usan); un solo acento por pantalla (azul CRS #1A6CA7); sin punto medio (U+00B7)
// ni raya larga (U+2014) en texto visible.
// =============================================================================
/* global penpot */

'use strict';

// -----------------------------------------------------------------------------
// 0. ACCESO A LA API (el runtime inyecta el global `penpot`).
// -----------------------------------------------------------------------------
const P = (typeof penpot !== 'undefined' && penpot) ? penpot
  : (typeof api !== 'undefined' && api && api.penpot) ? api.penpot : null;
const pluginUi = (P && P.ui) ? P.ui
  : (typeof api !== 'undefined' && api && api.ui) ? api.ui : null;

// -----------------------------------------------------------------------------
// 1. TOKENS DE MARCA (fuente: 2026-09-10_Sistema_de_Diseno_Tokens.md, v1.1)
// -----------------------------------------------------------------------------
const COLOR = {
  blue: '#1A6CA7',        // marca / creatividad principal
  black: '#1D1D1C',       // negro de marca (nunca negro puro #000)
  blue50: '#EAF2F8',      // fondos de estado
  blue100: '#CFE2F0',     // bordes suaves / fondos claros / fin del degradado
  blue300: '#7FB0D4',     // vidrio iluminado / acento interactivo en oscuro
  blue700: '#124C76',     // hover / texto sobre claro
  blue900: '#0B2E47',     // fondos oscuros profundos
  orange: '#F0A868',      // alerta / activo (solo advertencia)
  green: '#3FA97B',       // éxito
  red: '#D9534F',         // error / destructivo
  white: '#FFFFFF',       // solo como texto, objeto o superficie
  bgBase: '#F4F6F8',      // fondo base claro
  dark: '#0E1116',        // fondo base oscuro (no negro puro)
  darkPanel: '#131A24',   // panel oscuro
  textPrimary: '#1D1D1C',
  textSecondary: '#5A6068',
  textMuted: '#8B939C',
  textLight: '#F2F4F7',
  textMutedDark: '#6E7781',
};

// Familia única del sistema. No hay fuente display: los titulares se construyen
// con Plus Jakarta Sans en mayúsculas, peso alto y tracking amplio.
const FONT = 'Plus Jakarta Sans';
const WEIGHT = { regular: '400', medium: '500', semi: '600', bold: '700', black: '800' };

/** Objeto de fuente para `text()`: familia del sistema mas peso. */
function font(weight) {
  return { fontFamily: FONT, fontWeight: String(weight || WEIGHT.regular) };
}

// Tracking bajo a proposito: se lee bien tanto si Penpot interpreta
// `letterSpacing` como multiplo del tamano (em) como si lo interpreta en pixeles.
const TRACK = { display: '0.08', wide: '0.16', wider: '0.22', none: '0' };

// Retícula de presentación.
const BOARD_W = 1280;     // ancho fijo de las dos páginas
const BOARD_H = 800;      // alto de la portada (el índice es más alto)
const PAD = 64;           // padding de las cuatro caras del board
const PAD_CAJA = 20;      // relleno interior de toda caja visible
// Seguimiento de textos: los que no reciben ancho explicito se ajustan al
// ancho interior de su contenedor en columna. Se guarda fuera del objeto de la
// API a proposito: escribir propiedades nuevas en una forma de Penpot no es
// seguro.
const TEXT_AUTO = new WeakSet();
const TEXT_FIJO = new WeakMap();
const CONTENT_W = BOARD_W - PAD * 2;   // 1152
const GUTTER = 160;       // separación entre boards en el lienzo

// Contenido nuevo de la v9: propósito del sistema y los cinco pilares.
// Los pilares son los del perfil profesional del usuario (registrados 25/10).
// Formato compacto: número de orden y nombre corto en mayúsculas, sin adornos.
// -----------------------------------------------------------------------------
// 1.c EL BRIEF (v23). Estos son los datos que el cliente o el usuario escribe en
//     la ventana del plugin antes de generar. Los valores por defecto son los de
//     la marca CRS, así que el plugin sigue funcionando sin llenar nada.
//     Nada de esto lo inventa el plugin: viene del formulario.
// -----------------------------------------------------------------------------
const BRIEF_POR_DEFECTO = {
  proposito: 'Reúne la marca, sus fundamentos y sus aplicaciones digitales en una presentación editable.',
  significado: 'El símbolo es el cierre de etiqueta HTML, el gesto con el que se cierra una idea. La i es un playhead: marca dónde está el documento en su propio recorrido. El logotipo usa las esquinas rectas y los cortes a 45 grados del resto del sistema.',
  // v24: los elementos distintivos del logotipo. El primero es el principal y
  // es el que define el área de respeto; los demás son recursos de interfaz.
  distintivos: [
    ['simbolo >', true],
    ['playhead i', false],
    ['cinta con muesca', false],
    ['paralelogramo', false],
  ],
  pilares: [
    ['01', 'DIRECCIÓN DE ARTE', 'Estrategia visual y criterio de marca.'],
    ['02', 'MOTION Y NARRATIVA', 'El tiempo como material de diseño.'],
    ['03', 'IA Y FLUJOS', 'Automatizar lo repetible para ganar criterio.'],
    ['04', 'ARQUITECTURA WEB', 'Estructura, CMS y entornos digitales.'],
    ['05', 'UI/UX Y EXPERIENCIA', 'Interfaces que se entienden sin manual.'],
  ],
};

/** Brief vigente: se sustituye con lo que llega del formulario. */
let BRIEF = {
  proposito: BRIEF_POR_DEFECTO.proposito,
  significado: BRIEF_POR_DEFECTO.significado,
  pilares: BRIEF_POR_DEFECTO.pilares.map(function (p) { return [p[0], p[1], p[2]]; }),
  distintivos: BRIEF_POR_DEFECTO.distintivos.map(function (d) { return [d[0], d[1]]; }),
};

/**
 * Acepta el brief que llega del formulario. Tolera piezas ausentes y limpia
 * los textos: el plugin nunca se queda sin contenido por un formulario a medias.
 */
function aplicarBrief(entrante) {
  if (!entrante || typeof entrante !== 'object') return;

  if (typeof entrante.proposito === 'string' && entrante.proposito.trim()) {
    BRIEF.proposito = entrante.proposito.trim().slice(0, 240);
  }
  if (typeof entrante.significado === 'string' && entrante.significado.trim()) {
    BRIEF.significado = entrante.significado.trim().slice(0, 600);
  }
  if (Array.isArray(entrante.distintivos)) {
    const lista = [];
    for (let i = 0; i < entrante.distintivos.length && lista.length < 6; i++) {
      const d = entrante.distintivos[i];
      const nombre = String(d && d.nombre ? d.nombre : d || '').trim();
      if (!nombre) continue;
      lista.push([nombre.slice(0, 40), !!d && d.principal === true]);
    }
    if (lista.length) {
      // Solo puede haber un principal: si el formulario manda varios, gana el primero.
      let visto = false;
      BRIEF.distintivos = lista.map(function (d) {
        if (d[1] && !visto) { visto = true; return d; }
        return [d[0], false];
      });
      if (!visto) BRIEF.distintivos[0][1] = true;
    }
  }  if (Array.isArray(entrante.pilares)) {
    const limpios = [];
    for (let i = 0; i < entrante.pilares.length && limpios.length < 5; i++) {
      const p = entrante.pilares[i];
      let nombre = '';
      let detalle = '';
      if (typeof p === 'string') {
        nombre = p;
      } else if (p && typeof p === 'object') {
        nombre = (p.nombre || '');
        detalle = (p.detalle || '');
      }
      nombre = String(nombre).trim();
      if (!nombre) continue;
      limpios.push([pad2(limpios.length + 1), nombre.slice(0, 42).toUpperCase(), String(detalle).trim().slice(0, 90)]);
    }
    if (limpios.length) BRIEF.pilares = limpios;
  }
}
const PURPOSE = 'Reúne la marca, sus fundamentos y sus aplicaciones digitales en una presentación editable.';

const PILLARS = [
  ['01', 'DIRECCIÓN DE ARTE'],
  ['02', 'MOTION Y NARRATIVA'],
  ['03', 'IA Y FLUJOS'],
  ['04', 'ARQUITECTURA WEB'],
  ['05', 'UI/UX Y EXPERIENCIA'],
];

// -----------------------------------------------------------------------------
// NOTA PARA LA VERSIÓN 2.0 (cliente)
// Todos los textos de estas páginas son de la marca CRS y describen SU logotipo
// (el cierre de etiqueta, el playhead, la i como lápiz). En la 2.0 esos textos
// tienen que aplicarse a CUALQUIER logotipo: nada de lo que se escriba puede dar
// por hecho que el símbolo es un chevrón ni que la marca tiene un playhead. Los
// elementos y su significado llegarán en el brief del cliente, y los recursos de
// interfaz se construirán con SUS elementos distintivos, no con los de CRS.
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// 1.b TOKENS DEL SISTEMA (v10). Este objeto es la ÚNICA fuente de verdad:
//     de aquí salen la biblioteca compartida de Penpot y el archivo
//     tokens.json que publica el repositorio. Si un valor cambia, cambia en
//     los dos sitios a la vez y la web no puede desincronizarse.
//     Formato compatible con DTCG ($type y $value), que es el que espera la
//     pestaña de tokens y el que lee la landing del UI System.
// -----------------------------------------------------------------------------

// Escala de espacio del sistema de diseño: múltiplos de 4 (documento de tokens).
const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];

const FONT_STACK = 'Plus Jakarta Sans, system-ui, sans-serif';

/** Nombre, valor y descripción de los 19 colores del sistema. */
const TOKEN_COLORS = [
  ['crs/blue', COLOR.blue, 'Azul de marca: énfasis, enlaces, botones y numeración'],
  ['crs/black', COLOR.black, 'Negro de marca para texto'],
  ['crs/blue-50', COLOR.blue50, 'Fondo de estado y de alerta informativa'],
  ['crs/blue-100', COLOR.blue100, 'Bordes suaves y fin del degradado'],
  ['crs/blue-300', COLOR.blue300, 'Vidrio iluminado y acento interactivo en oscuro'],
  ['crs/blue-700', COLOR.blue700, 'Hover y texto sobre fondo claro'],
  ['crs/blue-900', COLOR.blue900, 'Fondos oscuros profundos'],
  ['crs/white', COLOR.white, 'Texto, objeto o superficie'],
  ['crs/bg-base', COLOR.bgBase, 'Fondo base claro'],
  ['crs/dark', COLOR.dark, 'Fondo base oscuro, nunca negro puro'],
  ['crs/dark-panel', COLOR.darkPanel, 'Panel oscuro'],
  ['crs/text-primary', COLOR.textPrimary, 'Texto principal'],
  ['crs/text-secondary', COLOR.textSecondary, 'Texto secundario'],
  ['crs/text-muted', COLOR.textMuted, 'Texto terciario'],
  ['crs/text-light', COLOR.textLight, 'Texto sobre fondo oscuro'],
  ['crs/text-muted-dark', COLOR.textMutedDark, 'Texto terciario en tema oscuro'],
  ['crs/accent-orange', COLOR.orange, 'Solo advertencia o precaución'],
  ['crs/accent-success', COLOR.green, 'Solo éxito o mensaje positivo'],
  ['crs/accent-danger', COLOR.red, 'Solo error o señal negativa'],
];

/** Escala tipográfica: nombre, peso y tamaño en píxeles. */
const TOKEN_TYPOS = [
  ['display/hero', WEIGHT.black, 96, 'Titular de portada'],
  ['display/h1', WEIGHT.black, 60, 'Título de página'],
  ['display/h2', WEIGHT.bold, 40, 'Título de sección'],
  ['display/h3', WEIGHT.bold, 24, 'Subtítulo y nombre de producto'],
  ['body/large', WEIGHT.regular, 18, 'Texto destacado'],
  ['body/base', WEIGHT.regular, 16, 'Texto base'],
  ['body/small', WEIGHT.regular, 14, 'Texto secundario'],
  ['label/caps', WEIGHT.bold, 12, 'Etiquetas en mayúsculas con tracking'],
];

/**
 * Construye el objeto de tokens del sistema. Se usa para publicar tokens.json
 * y para crear la biblioteca compartida, así que no hay dos listas.
 */
function buildTokens() {
  const color = {};
  TOKEN_COLORS.forEach(function (c) {
    color[c[0].replace('crs/', '')] = { $type: 'color', $value: c[1], $description: c[2] };
  });

  const typography = {};
  TOKEN_TYPOS.forEach(function (t) {
    typography[t[0].replace('/', '-')] = {
      $type: 'typography',
      $value: { fontFamily: FONT, fontWeight: t[1], fontSize: t[2] },
      $description: t[3],
    };
  });

  const space = {};
  SPACING.forEach(function (v, i) {
    space['s' + (i + 1)] = { $type: 'dimension', $value: v };
  });

  return {
    $description: 'Design tokens del sistema CRS. Fuente única: el plugin de Penpot. Lo leen el plugin, la página del proyecto y la landing del UI System.',
    $extensions: {
      'crs.source': 'penpot/v10/plugin.js',
      'crs.fontFamily': FONT,
      'crs.fontStack': FONT_STACK,
      'crs.spacingScale': SPACING,
      'crs.generated': 'buildTokens()',
    },
    color: color,
    typography: typography,
    space: space,
  };
}

// -----------------------------------------------------------------------------
// 2. UTILIDADES DE BAJO NIVEL (llamadas reales a la API de Penpot).
// -----------------------------------------------------------------------------

/** Nombre válido para Penpot: nunca vacío. */
function safeName(value, fallback) {
  const s = (value == null) ? '' : String(value).trim();
  return s.length ? s.slice(0, 64) : (fallback || 'Capa');
}

/** Número de dos dígitos (01, 02...). */
function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * Trazo (borde). v21: la interfaz `Stroke` de Penpot NO usa `fillColor`, sino
 * `strokeColor`, `strokeOpacity`, `strokeWidth` y `strokeAlignment`. Pasarle un
 * objeto de relleno hace que el runtime lo descarte en silencio, y por eso
 * ningun borde se dibujaba desde la v10.
 */
function stroke(color, opacity, width, alineacion) {
  return {
    strokeColor: color || COLOR.textPrimary,
    strokeOpacity: opacity == null ? 1 : opacity,
    strokeWidth: width == null ? 1 : width,
    strokeAlignment: alineacion || 'inner',
  };
}
/** Fill de color sólido. */
function solid(color, opacity) {
  return { fillColor: color, fillOpacity: opacity == null ? 1 : opacity };
}

/**
 * Contenedor. En el runtime real de Penpot no hay createFrame: se cae a
 * createBoard, que es lo que hace la v5 y lo que dibuja bien.
 */
function makeFrame() {
  if (P && typeof P.createFrame === 'function') {
    try { return P.createFrame(); } catch (e) { /* cae a board */ }
  }
  if (P && typeof P.createGroup === 'function') {
    try { return P.createGroup(); } catch (e) { /* cae a board */ }
  }
  return P.createBoard();
}

/**
 * Contenedor con tamaño, relleno, borde, sombra y FLEX LAYOUT.
 * El flex se pide siempre (dir por defecto 'column'), porque en la v8 el
 * espaciado se resuelve con gap, padding y anidación, nunca con x/y.
 *   justify -> justifyContent (eje principal)
 *   align   -> alignItems     (eje transversal)
 */
function box(name, opts) {
  const o = opts || {};
  const f = makeFrame();
  f.name = safeName(name, 'Contenedor');
  try {
    if (o.w != null) f.resize(o.w, o.h != null ? o.h : f.height);
    else if (o.h != null) f.resize(f.width, o.h);
  } catch (e) { /* tamaño por defecto */ }
  if (o.fills) { try { f.fills = o.fills; } catch (e) { /* fill opcional */ } }
  if (o.strokes) { try { f.strokes = o.strokes; } catch (e) { /* borde opcional */ } }
  if (o.shadow) { try { f.shadows = o.shadow; } catch (e) { /* sombra opcional */ } }

  // v15: los contenedores de estructura NO pintan fondo. Antes heredaban el
  // fondo por defecto del marco y se veían como cajas con el texto pegado al
  // borde. Solo pinta quien recibe `fills` de forma explícita.
  if (!o.fills) {
    try { f.fills = []; } catch (e) { /* sin fill */ }
  }

  const wantsFlex = !!(o.dir || o.justify || o.align || o.gap != null ||
    o.pad != null || o.padH != null || o.padV != null);
  if (wantsFlex) {
    try {
      const flex = f.addFlexLayout();
      flex.dir = o.dir || 'column';
      if (o.justify) flex.justifyContent = o.justify;
      if (o.align) flex.alignItems = o.align;
      if (o.gap != null) { flex.rowGap = o.gap; flex.columnGap = o.gap; }
      let pad = null;
      if (o.pad != null) {
        pad = { p1: o.pad, p2: o.pad, p3: o.pad, p4: o.pad };
      } else if (o.padH != null || o.padV != null) {
        pad = { p1: o.padV || 0, p2: o.padH || 0, p3: o.padV || 0, p4: o.padH || 0 };
      } else if (o.fills || o.strokes) {
        // v15: toda caja visible lleva relleno interior. Sin esto el texto
        // toca el borde de la caja, que es lo que se veía mal.
        pad = { p1: PAD_CAJA, p2: PAD_CAJA, p3: PAD_CAJA, p4: PAD_CAJA };
      }
      if (pad) {
        flex.topPadding = pad.p1;
        flex.rightPadding = pad.p2;
        flex.bottomPadding = pad.p3;
        flex.leftPadding = pad.p4;
      }
    } catch (e) { /* sin flex: el contenedor queda simple */ }
  }
  return f;
}

/**
 * Ancho interior de un contenedor: descuenta el relleno que aplica box().
 */
function anchoInterior(o) {
  if (o.w == null) return null;
  let pad = 0;
  if (o.pad != null) pad = o.pad;
  else if (o.padH != null) pad = o.padH;
  else if (o.fills || o.strokes) pad = PAD_CAJA;
  return Math.max(60, o.w - pad * 2);
}

/**
 * Contenedor con sus hijos agregados EN ORDEN (patrón de la v5).
 * v20: los textos SIN ancho propio se ajustan al ancho interior del contenedor
 * cuando este apila en columna. Antes crecian a su ancho natural (548 px en la
 * captura) y se salian de la caja, donde quedaban recortados u ocultos.
 */
function container(name, opts, children) {
  const o = opts || {};
  const b = box(name, o);
  const list = children || [];
  const autoW = anchoInterior(o);
  const enColumna = (!o.dir || o.dir === 'column');
  for (let i = 0; i < list.length; i++) {
    const child = list[i];
    if (!child) continue;
    if (enColumna && autoW != null && TEXT_AUTO.has(child) && !TEXT_FIJO.has(child)) {
      try { child.resize(autoW, child.height); } catch (e) { /* deja su ancho */ }
    }
    try { b.appendChild(child); } catch (e) { /* hijo opcional */ }
  }
  return b;
}

/** Rectángulo de esquinas rectas. `w`/`h` van por resize (son de solo lectura). */
function rect(name, w, h, color, opacity) {
  const r = P.createRectangle();
  r.name = safeName(name, 'Rectangulo');
  try { r.resize(w, h); } catch (e) { /* tamaño por defecto */ }
  if (color != null) {
    try { r.fills = [solid(color, opacity)]; } catch (e) { /* fill opcional */ }
  }
  return r;
}

/** Filete horizontal de 1 px (separador de la presentación). */
function hairline(name, w, color, opacity) {
  return rect(name || 'filete', w, 1, color || COLOR.textPrimary, opacity == null ? 0.10 : opacity);
}

/**
 * Texto con propiedades directas. Orden importante: growType ANTES de resize
 * (si no, el tamaño fijo se pierde) y align después.
 */
function text(content, opts) {
  const o = opts || {};
  if (!P || typeof P.createText !== 'function') {
    throw new Error('La API de Penpot no expone createText');
  }
  const t = P.createText(String(content));
  // Sin ancho explicito el texto se ajusta al contenedor, no crece a su gusto.
  if (o.w != null) { TEXT_FIJO.set(t, o.w); } else { TEXT_AUTO.add(t); }
  t.name = safeName(o.name || content, 'Texto');
  const size = o.size != null ? o.size : 14;
  const f = o.font || font(WEIGHT.regular);
  try {
    t.fontFamily = f.fontFamily;
    t.fontStyle = 'normal';
    t.fontWeight = String(f.fontWeight || WEIGHT.regular);
    t.fontSize = String(size);
    t.lineHeight = o.lineHeight != null ? String(o.lineHeight) : '1.2';
    t.letterSpacing = o.letterSpacing != null ? String(o.letterSpacing) : TRACK.none;
    t.textDecoration = 'none';
    t.textTransform = o.transform || 'none';
  } catch (e) { /* la tipografía degrada a la fuente por defecto */ }

  try { t.fills = [solid(o.color || COLOR.textPrimary, o.opacity)]; } catch (e) { /* color opcional */ }

  if (o.growType) {
    try { t.growType = o.growType; } catch (e) { /* opcional */ }
  }
  if (o.w != null) {
    try { t.resize(o.w, o.h != null ? o.h : t.height); } catch (e) { /* opcional */ }
  } else if (o.h != null) {
    try { t.resize(t.width, o.h); } catch (e) { /* opcional */ }
  }
  try {
    if (o.align) t.align = o.align;
    if (o.valign) t.verticalAlign = o.valign;
  } catch (e) { /* alineación opcional */ }
  return t;
}

/** Etiqueta en mayúsculas con tracking amplio (caps del sistema). */
function label(content, opts) {
  const o = Object.assign({
    size: 11,
    font: font(WEIGHT.bold),
    color: COLOR.textMuted,
    letterSpacing: TRACK.wide,
    lineHeight: '1.2',
  }, opts || {});
  return text(String(content).toUpperCase(), o);
}

/**
 * Símbolo de marca ">". v13: se dibuja con la FORMA DEL LOGOTIPO, no con una
 * fuente. Las coordenadas son las del polígono del SVG oficial, así que la
 * firma de la marca es la misma en portada, índice, reglas y recursos.
 * `size` es el alto en píxeles de la pieza; el ancho sale de su proporción.
 * Si el runtime no puede importar SVG, cae al glifo como último recurso.
 */
function markGt(size, color, weight) {
  const alto = Math.max(8, Math.round(size || 16));
  const ancho = Math.round(alto * 0.75);
  const pieza = brandMark('chevron', color || COLOR.blue, ancho, alto);
  if (pieza) return pieza;

  // Respaldo: glifo de la fuente del sistema.
  return text('>', {
    name: 'simbolo > (respaldo)',
    size: alto,
    color: color || COLOR.blue,
    font: font(weight || WEIGHT.black),
    letterSpacing: TRACK.none,
    lineHeight: '1',
  });
}

// -----------------------------------------------------------------------------
// 3. PIEZAS COMPARTIDAS DE LA PRESENTACIÓN (barra superior y pie).
//    Todo con flex: fila de dos hijos y justifyContent 'space-between' para
//    dejar la etiqueta de la derecha pegada al margen.
// -----------------------------------------------------------------------------

/**
 * Barra superior: ">" + nombre del sistema a la izquierda, etiqueta de versión
 * a la derecha. Fila con justifyContent 'space-between'.
 */
function topBar(width, rightText) {
  const left = container('barra / marca', {
    w: 240, h: 24, dir: 'row', gap: 8, align: 'center', justify: 'start',
  }, [
    markGt(16, COLOR.blue, WEIGHT.black),
    label('CRS DISEÑO', { size: 13, color: COLOR.textPrimary, letterSpacing: TRACK.wide }),
  ]);

  const right = rightText
    ? label(rightText, { size: 11, color: COLOR.textMuted, letterSpacing: TRACK.wider })
    : null;

  return container('barra superior' + (rightText ? ' / ' + rightText : ''), {
    w: width, h: 24, dir: 'row', gap: 24, align: 'center', justify: 'space-between',
  }, [left, right]);
}

/** Cabecera de página: barra superior mas filete. */
function topBlock(width, rightText) {
  return container('cabecera', {
    w: width, h: 39, dir: 'column', gap: 14, align: 'start', justify: 'start',
  }, [
    topBar(width, rightText),
    hairline('filete superior', width, COLOR.textPrimary, 0.10),
  ]);
}

/**
 * Pie de página: filete mas fila de dos etiquetas (izquierda y derecha).
 * Fila con justifyContent 'space-between': nada de coordenadas.
 */
function footerBlock(width, leftText, rightText) {
  const row = container('pie / datos', {
    w: width, h: 16, dir: 'row', gap: 24, align: 'center', justify: 'space-between',
  }, [
    label(leftText, { size: 11, color: COLOR.textSecondary, letterSpacing: TRACK.wide }),
    rightText ? label(rightText, { size: 11, color: COLOR.textMuted, letterSpacing: TRACK.wider }) : null,
  ]);

  return container('pie', {
    w: width, h: 29, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [
    hairline('filete inferior', width, COLOR.textPrimary, 0.10),
    row,
  ]);
}

// -----------------------------------------------------------------------------
// 3.b CONTENIDO NUEVO DE LA v9 (propósito y pilares). Sin cajas, sin sombras y
//     sin degradados: texto y retícula, para que la portada explique antes de
//     lucir. Es lo que faltaba según el usuario: la página se veía vacía.
// -----------------------------------------------------------------------------

/** Frase de propósito del sistema. Texto corrido, una sola idea. */
function purposeLine(width) {
  return text(BRIEF.proposito, {
    name: 'proposito',
    size: 17,
    font: font(WEIGHT.regular),
    color: COLOR.textSecondary,
    letterSpacing: '0.01',
    lineHeight: '1.35',
    w: width,
  });
}

/**
 * Los cinco pilares profesionales en formato compacto: una fila de cinco
 * columnas con número, nombre corto en mayúsculas y filete de retícula.
 * El ancho de cada columna se calcula a partir del ancho disponible, así que
 * añadir o quitar un pilar no rompe la retícula.
 */
function pillarsRow(width) {
  const gap = 12;
  const lista = BRIEF.pilares;
  const cell = Math.floor((width - gap * (lista.length - 1)) / lista.length);

  const cells = lista.map(function (p) {
    return container('pilar / ' + p[0], {
      w: cell, h: 90, dir: 'column', gap: 6, align: 'start', justify: 'center',
    }, [
      text(p[0], {
        name: 'pilar numero / ' + p[0],
        size: 11,
        font: font(WEIGHT.black),
        color: COLOR.blue,
        letterSpacing: TRACK.wide,
        lineHeight: '1.1',
      }),
      // v24: icono GENERICO de columna, igual para todos los pilares. Se dibuja
      // con primitivas para no depender de iconos exactos por pilar.
      // v25: el icono va en una fila con alineación centrada (align 'end' no
      // daba resultado) y con un contenedor del alto exacto de las piezas.
      container('pilar icono / ' + p[0], {
        w: cell, h: 30, dir: 'row', gap: 4, align: 'center', justify: 'start',
      }, [
        iconoColumna(28) || rect('columna / ' + p[0], 8, 20, COLOR.blue),
      ]),
      text(p[1], {
        name: 'pilar nombre / ' + p[0],
        size: 11,
        font: font(WEIGHT.bold),
        color: COLOR.textPrimary,
        letterSpacing: '0.06',
        lineHeight: '1.2',
        w: cell,
      }),
    ]);
  });

  return container('pilares / fila', {
    w: width, h: 90, dir: 'row', gap: gap, align: 'start', justify: 'start',
  }, cells);
}

/** Bloque de pilares: etiqueta, filete de retícula y la fila de cinco. */
function pillarsBlock(width) {
  return container('pilares', {
    w: width, h: 129, dir: 'column', gap: 14, align: 'start', justify: 'start',
  }, [
    label(BRIEF.pilares.length + ' PILARES PROFESIONALES', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    hairline('filete de pilares', width, COLOR.textPrimary, 0.10),
    pillarsRow(width),
  ]);
}

// -----------------------------------------------------------------------------
// 4. FONDO DEL BOARD (degradado dentro de la paleta de azules, o blanco).
//    Se aplica como PROPIEDAD del board (fills), no como capa posicionada:
//    una capa absoluta rompería el flex y es justo lo que fallaba en v6/v7.
// -----------------------------------------------------------------------------

/**
 * Intenta aplicar un degradado lineal y VERIFICA la lectura.
 * La clave válida de la interfaz `Fill` de Penpot es `fillColorGradient`
 * (plugin-types/index.d.ts, campo declarado del fill). Con `fillGradient` el
 * runtime descarta el valor en silencio y el board se queda sin degradado,
 * así que aquí se usa la correcta y se relee para confirmarlo.
 */
function paintBoard(board, endColor) {
  const to = endColor || COLOR.blue100;
  let gradientOk = false;
  try {
    board.fills = [{
      fillColorGradient: {
        type: 'linear',
        startX: 0, startY: 0, endX: 0, endY: 1,
        width: 1,
        stops: [
          { color: COLOR.white, opacity: 1, offset: 0 },
          { color: COLOR.blue50, opacity: 1, offset: 0.55 },
          { color: to, opacity: 1, offset: 1 },
        ],
      },
    }];
    const read = board.fills;
    gradientOk = !!(read && read[0] && read[0].fillColorGradient);
  } catch (e) {
    gradientOk = false;
  }
  if (!gradientOk) {
    try { board.fills = [solid(COLOR.white)]; } catch (e) { /* fill opcional */ }
  }
  return gradientOk;
}

// -----------------------------------------------------------------------------
// 5. BUILDERS DE LAS PÁGINAS (una función por sección, sin estado compartido).
//    Patrón obligatorio: contenedores con flex y appendChild en orden.
// -----------------------------------------------------------------------------

/**
 * 00 / PORTADA
 * Contenido alineado a la izquierda sobre 1280 x 800, con el board en flex
 * column y justifyContent 'space-between': la cabecera arriba, el bloque de
 * marca en el centro del aire disponible y el pie abajo. Un solo acento: azul.
 */
function buildPortada(board, section) {
  const W = section.width || BOARD_W;
  const cw = W - PAD * 2;
  const logos = LOGOS || {};

  const gradientOk = paintBoard(board, COLOR.blue100);
  try { console.log('[CRS] gradiente nativo=' + gradientOk); } catch (e) { /* diagnóstico opcional */ }

  // Cabecera: ">" + CRS DISEÑO a la izquierda, etiqueta de versión a la derecha.
  const cabecera = topBlock(cw, 'SISTEMA DE DISEÑO 1.12');

  // Bloque de marca: el LOGOTIPO OFICIAL (v24), no el símbolo con el nombre.
  const logoPortada = svgShape(logos.color, 'logotipo / portada', 470, 470) || markGt(120, COLOR.blue);
  const bloque = container('bloque / marca', {
    w: cw, h: 382, dir: 'column', gap: 18, align: 'start', justify: 'center',
  }, [
    logoPortada,
    rect('acento', 96, 6, COLOR.blue),
    label('DIRECTOR DE ARTE  |  LÍDER CREATIVO', {
      size: 16, color: COLOR.blue, letterSpacing: TRACK.wider,
    }),
    text('Sistema de diseño, versión 1.12', {
      name: 'subtitulo',
      size: 21,
      font: font(WEIGHT.regular),
      color: COLOR.textSecondary,
      letterSpacing: TRACK.none,
      lineHeight: '1.3',
    }),
  ]);


  // Pie: fecha a la izquierda, "DOCUMENTO INTERNO" a la derecha.
  const pie = footerBlock(cw, 'ACTUALIZADO EN OCTUBRE DE 2026', 'DOCUMENTO INTERNO');

  // ORDEN de los hijos del board: este orden es el que dibuja el flex.
  board.appendChild(cabecera);
  board.appendChild(bloque);
  board.appendChild(pie);
}

/**
 * 01 / ÍNDICE
 * Encabezado con el titular y la bajada, y una fila por sección listada:
 * número, viñeta ">", título, frase corta y filete separador. Las filas se
 * leen de SECTIONS con `listed: true`, así que el menú se actualiza solo y
 * nunca lista a la portada ni al propio índice.
 */
function buildIndice(board, section) {
  const W = section.width || BOARD_W;
  const cw = W - PAD * 2;
  const items = listedSections();

  const gradientOk = paintBoard(board, COLOR.blue50);
  try { console.log('[CRS] gradiente nativo=' + gradientOk); } catch (e) { /* diagnóstico opcional */ }

  const cabecera = topBlock(cw, 'SISTEMA DE DISEÑO 1.12');

  // Encabezado: titular ÍNDICE y fila "CONTENIDO DE LA PRESENTACIÓN" / contador.
  const bajada = container('bajada', {
    w: cw, h: 18, dir: 'row', gap: 24, align: 'center', justify: 'space-between',
  }, [
    label('CONTENIDO DE LA PRESENTACIÓN', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    label(pad2(items.length) + ' SECCIONES', { size: 11, color: COLOR.textMuted, letterSpacing: TRACK.wider }),
  ]);

  const encabezado = container('encabezado', {
    w: cw, h: 101, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [
    text('ÍNDICE', {
      name: 'titular / indice',
      size: 56,
      font: font(WEIGHT.black),
      color: COLOR.textPrimary,
      letterSpacing: TRACK.display,
      lineHeight: '1.05',
    }),
    bajada,
    hairline('filete de encabezado', cw, COLOR.textPrimary, 0.10),
  ]);

  // Filas del índice: una por sección listada, con su filete separador.
  // El alto del contenedor se fija a la suma de sus filas (76 por fila mas los
  // filetes intermedios de 1 px) para que el board no recorte el contenido.
  const altoFilas = items.length * 76 + Math.max(0, items.length - 1);
  const filas = container('filas', {
    w: cw, h: altoFilas, dir: 'column', gap: 0, align: 'start', justify: 'start',
  }, []);

  const colNum = 44;
  const colVin = 20;
  const colEstado = 132;
  const gaps = 18 * 3;

  items.forEach(function (item, i) {
    const num = item.number || pad2(i + 1);

    // Columna del número (ancho fijo para que la retícula quede alineada).
    const celdaNumero = container('numero / ' + num, {
      w: colNum, h: 76, dir: 'row', gap: 0, align: 'center', justify: 'start',
    }, [
      text(num, {
        name: 'numero / ' + num,
        size: 13,
        font: font(WEIGHT.black),
        color: COLOR.blue,
        letterSpacing: TRACK.wide,
        lineHeight: '1.2',
      }),
    ]);

    // Viñeta de marca ">" (lista sin orden de elementos importantes).
    const celdaVineta = container('vineta / ' + num, {
      w: colVin, h: 76, dir: 'row', gap: 0, align: 'center', justify: 'start',
    }, [
      markGt(16, COLOR.blue, WEIGHT.black),
    ]);

    // Título y frase corta de la sección.
    const celdaTexto = container('texto / ' + num, {
      w: cw - colNum - colVin - colEstado - gaps, h: 62, dir: 'column', gap: 6, align: 'start', justify: 'center',
    }, [
      text(item.title, {
        name: 'titulo / ' + num,
        size: 24,
        font: font(WEIGHT.bold),
        color: COLOR.textPrimary,
        letterSpacing: '0.02',
        lineHeight: '1.2',
      }),
      text(item.description, {
        name: 'frase / ' + num,
        size: 13,
        font: font(WEIGHT.regular),
        color: COLOR.textSecondary,
        letterSpacing: '0.01',
        lineHeight: '1.3',
      }),
    ]);

    // v9: columna de estado de la sección. El color no es decorativo:
    // azul para lo que ya existe, gris apagado para lo planificado.
    const estado = item.state || 'PLANIFICADA';
    const colorEstado = (estado === 'GENERADA' || estado === 'EN DISEÑO') ? COLOR.blue : COLOR.textMuted;
    const celdaEstado = container('estado / ' + num, {
      w: colEstado, h: 76, dir: 'row', gap: 0, align: 'center', justify: 'end',
    }, [
      text(estado, {
        name: 'estado / ' + num,
        size: 10,
        font: font(WEIGHT.bold),
        color: colorEstado,
        letterSpacing: TRACK.wider,
        lineHeight: '1.2',
        align: 'right',
      }),
    ]);

    filas.appendChild(container('fila / ' + num, {
      w: cw, h: 76, dir: 'row', gap: 18, align: 'center', justify: 'start',
    }, [celdaNumero, celdaVineta, celdaTexto, celdaEstado]));

    // Filete separador de la fila. Se omite en la última (ahí cierra el pie).
    if (i < items.length - 1) {
      filas.appendChild(hairline('separador / ' + num, cw, COLOR.textPrimary, 0.08));
    }
  });

  const pie = footerBlock(cw, 'CRS DISEÑO  |  SISTEMA DE DISEÑO 1.12', 'PÁGINA 02');

  // ORDEN de los hijos del board.
  board.appendChild(cabecera);
  board.appendChild(encabezado);
  board.appendChild(filas);
  board.appendChild(pie);
}

/**
 * 02 / PROPÓSITO Y PILARES (v23)
 * Esta página es el brief convertido en página: la frase de propósito, lo que
 * significa la marca y los pilares en retícula. Todo viene del formulario del
 * plugin (BRIEF); si el usuario no escribe nada, se usan los valores de CRS.
 */
function buildProposito(board, section) {
  const W = section.width || BOARD_W;
  const cw = W - PAD * 2;

  const gradientOk = paintBoard(board, COLOR.blue50);
  try { console.log('[CRS] gradiente nativo=' + gradientOk); } catch (e) { /* opcional */ }

  const cabecera = topBlock(cw, 'SISTEMA DE DISEÑO 1.12');

  const bajada = container('bajada', {
    w: cw, h: 18, dir: 'row', gap: 24, align: 'center', justify: 'space-between',
  }, [
    label('EL BRIEF DEL SISTEMA: PROPÓSITO, SIGNIFICADO Y PILARES', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    label('SECCIÓN 01', { size: 11, color: COLOR.textMuted, letterSpacing: TRACK.wider }),
  ]);

  const encabezado = container('encabezado', {
    w: cw, h: 101, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [
    text('PROPÓSITO Y PILARES', {
      name: 'titular / proposito',
      size: 48,
      font: font(WEIGHT.black),
      color: COLOR.textPrimary,
      letterSpacing: TRACK.display,
      lineHeight: '1.05',
    }),
    bajada,
    hairline('filete de encabezado', cw, COLOR.textPrimary, 0.10),
  ]);

  // La frase de propósito, a tamaño de declaración.
  const frase = container('frase de proposito', {
    w: cw, h: 132, dir: 'column', gap: 14, align: 'start', justify: 'center',
  }, [
    label('PROPÓSITO', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    text(BRIEF.proposito, {
      name: 'proposito / frase',
      size: 26,
      font: font(WEIGHT.medium),
      color: COLOR.textPrimary,
      letterSpacing: '0.01',
      lineHeight: '1.3',
      w: cw,
    }),
  ]);

  // Lo que significa la marca: el por qué de las formas.
  const significado = container('significado de la marca', {
    w: cw, h: 132, dir: 'column', gap: 12, align: 'start', justify: 'center',
  }, [
    label('QUÉ SIGNIFICA LA MARCA', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    hairline('filete de significado', cw, COLOR.textPrimary, 0.10),
    text(BRIEF.significado, {
      name: 'significado / texto',
      size: 15,
      font: font(WEIGHT.regular),
      color: COLOR.textSecondary,
      letterSpacing: '0.01',
      lineHeight: '1.45',
      w: cw,
    }),
  ]);

  // Los pilares, en retícula del ancho disponible.
  const pilares = pillarsBlock(cw);

  const pie = footerBlock(cw, 'CRS DISEÑO  |  SISTEMA DE DISEÑO 1.12', 'PÁGINA 03');

  board.appendChild(cabecera);
  board.appendChild(encabezado);
  board.appendChild(frase);
  board.appendChild(significado);
  board.appendChild(pilares);
  board.appendChild(pie);
}
// -----------------------------------------------------------------------------
// 5.b LOGOTIPO (v10). El plugin NO puede leer carpetas locales, así que el SVG
//     entra por la ventana del plugin: el usuario lo arrastra, el UI lo lee con
//     FileReader y lo manda aquí como texto. Si no arrastra nada, se intenta
//     descargar el SVG oficial que viaja en la propia carpeta del plugin.
// -----------------------------------------------------------------------------

/** Logos que viajan con el plugin, servidos desde su mismo host. */
const LOGO_FILES = {
  color: 'logo-full.svg',
  negro: 'logo-negro.svg',
  blanco: 'logo-blanco.svg',
};

/** Lo que llegó por arrastre: { name, svg } o null. */
let LOGO_RECIBIDO = null;

/** SVG ya resueltos para esta generación (los llena loadLogos()). */
let LOGOS = {};

/**
 * Los tres SVG oficiales EMBEBIDOS en el código (v11).
 * Motivo: en el runtime real de Penpot el `fetch` a un archivo hermano no
 * llega, así que las variantes negro y blanco salían sin logotipo y caían al
 * respaldo del símbolo. Con el texto dentro del propio plugin no hay red de
 * por medio. Este bloque lo reescribe `analisis\gen_logo_inline.js` desde los
 * archivos de la carpeta, así que el SVG sigue siendo el oficial.
 */
/* LOGO-INLINE-START */
const LOGO_SVG_INLINE = {"color":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"Capa_2\" data-name=\"Capa 2\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 552.23 141.34\">\n  <defs>\n    <style>\n      .cls-1 {\n        fill: #2e2d2c;\n      }\n\n      .cls-2 {\n        fill: #1c6ca9;\n      }\n    </style>\n  </defs>\n  <g id=\"Vectores\">\n    <g>\n      <g>\n        <g>\n          <path class=\"cls-1\" d=\"m36.21,67.9c-10,0-18.11-8.11-18.11-18.11s8.11-18.11,18.11-18.11c5,0,9.53,2.03,12.8,5.3l12.8-12.8c-6.55-6.55-15.61-10.61-25.61-10.61C16.21,13.58,0,29.79,0,49.79s16.21,36.21,36.21,36.21c10,0,19.05-4.05,25.61-10.61l-12.8-12.8c-3.28,3.28-7.8,5.3-12.8,5.3Z\"/>\n          <polygon class=\"cls-1\" points=\"181.06 58.84 181.06 86 126.74 86 135.79 67.9 162.95 67.9 135.79 40.74 135.79 13.58 190.11 13.58 181.06 31.69 153.9 31.82 181.06 58.84\"/>\n          <polygon class=\"cls-1\" points=\"67.9 13.58 67.9 86 86 67.9 86 49.79 86 31.69 104.11 31.69 86 49.79 122.21 86 122.21 58.84 113.16 49.79 122.21 40.74 122.21 31.69 122.21 13.58 67.9 13.58\"/>\n        </g>\n        <g>\n          <polygon class=\"cls-2\" points=\"353.06 58.84 353.06 86 298.75 86 307.8 67.9 334.96 67.9 307.8 40.74 307.8 13.58 362.12 13.58 353.06 31.69 325.9 31.82 353.06 58.84\"/>\n          <polygon class=\"cls-2\" points=\"208.22 13.58 235.1 49.79 208.22 86 235.38 86 262.53 49.79 235.38 13.58 208.22 13.58\"/>\n          <polygon class=\"cls-2\" points=\"271.59 13.58 271.59 76.95 282.9 95.06 282.9 95.05 282.9 95.06 294.22 76.95 294.22 13.58 271.59 13.58\"/>\n          <polygon class=\"cls-2\" points=\"380.22 67.9 380.22 58.84 398.33 58.84 398.33 40.74 380.22 40.74 380.22 31.69 398.33 31.69 416.43 13.58 362.12 13.58 362.12 86 416.43 86 398.33 67.9 380.22 67.9\"/>\n          <polygon class=\"cls-2\" points=\"416.43 95.06 416.43 13.58 434.54 13.58 452.64 49.79 452.64 22.63 470.75 4.53 470.75 86 452.64 86 434.54 49.79 434.54 76.95 416.43 95.06\"/>\n          <polygon class=\"cls-2\" points=\"425.49 9.05 461.7 9.05 452.64 0 416.43 0 425.49 9.05\"/>\n          <path class=\"cls-2\" d=\"m516.01,13.58c-20,0-36.21,16.21-36.21,36.21s16.21,36.21,36.21,36.21,36.21-16.21,36.21-36.21-16.21-36.21-36.21-36.21Zm0,54.32c-10,0-18.11-8.11-18.11-18.11s8.11-18.11,18.11-18.11,18.11,8.11,18.11,18.11-8.11,18.11-18.11,18.11Z\"/>\n        </g>\n      </g>\n      <path class=\"cls-1\" d=\"m0,104.11h552.23v3.49H0v-3.49Z\"/>\n      <g>\n        <path class=\"cls-1\" d=\"m0,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24H0Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04H3.06v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m21.55,135.34v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m31.31,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m51.7,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m81.91,124.56h-8.23v8.31h8.23v-2.82l3.05.63v1.55c0,1.2-.23,2.02-.68,2.45s-1.31.65-2.58.65h-7.84c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h7.84c1.27,0,2.13.22,2.58.66.45.44.68,1.25.68,2.45v1.24l-3.05.48v-2.48Z\"/>\n        <path class=\"cls-1\" d=\"m97.38,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m106.89,125.32c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h9.66c1.27,0,2.14.22,2.58.66.45.44.67,1.25.67,2.45v6.92c0,1.2-.22,2.02-.67,2.45-.45.43-1.31.65-2.58.65h-9.66c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92Zm3.05,7.55h10.07v-8.31h-10.07v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m129.49,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m159.73,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24h-7.66Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04h-5.41v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m181.28,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m207.82,135.34l7.43-13.13h2.94l7.53,13.13h-3.43l-1.58-2.87h-8.32l-1.53,2.87h-3.04Zm5.87-5.24h5.75l-2.83-5.34-2.92,5.34Z\"/>\n        <path class=\"cls-1\" d=\"m229.93,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m255.99,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m265.77,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m298.77,115.91v25.43h-1.86v-25.43h1.86Z\"/>\n        <path class=\"cls-1\" d=\"m317.39,135.34v-13.13h3.06v10.66h9.85v2.47h-12.9Z\"/>\n        <path class=\"cls-1\" d=\"m334.46,120.82l2.53-4.3h2.76l-3.66,4.3h-1.63Zm.3,14.52v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m344.52,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24h-7.66Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04h-5.41v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m366.07,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m385.27,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m426.52,124.56h-8.23v8.31h8.23v-2.82l3.05.63v1.55c0,1.2-.23,2.02-.68,2.45s-1.31.65-2.58.65h-7.84c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h7.84c1.27,0,2.13.22,2.58.66.45.44.68,1.25.68,2.45v1.24l-3.05.48v-2.48Z\"/>\n        <path class=\"cls-1\" d=\"m435.87,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m456.27,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m472.96,135.34l7.43-13.13h2.94l7.53,13.13h-3.43l-1.58-2.87h-8.32l-1.53,2.87h-3.04Zm5.87-5.24h5.75l-2.83-5.34-2.92,5.34Z\"/>\n        <path class=\"cls-1\" d=\"m499.46,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m509.25,135.34v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m523.44,135.34l-7.59-13.13h3.49l5.31,9.49,5.07-9.49h3.04l-7.22,13.13h-2.11Z\"/>\n        <path class=\"cls-1\" d=\"m536.06,125.32c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h9.66c1.27,0,2.14.22,2.58.66.45.44.67,1.25.67,2.45v6.92c0,1.2-.22,2.02-.67,2.45-.45.43-1.31.65-2.58.65h-9.66c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92Zm3.05,7.55h10.07v-8.31h-10.07v8.31Z\"/>\n      </g>\n    </g>\n  </g>\n</svg>","negro":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"Capa_2\" data-name=\"Capa 2\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 552.23 141.34\">\n  <defs>\n    <style>\n      .cls-1 {\n        fill: #2e2d2c;\n      }\n    </style>\n  </defs>\n  <g id=\"Vectores\">\n    <g>\n      <g>\n        <g>\n          <path class=\"cls-1\" d=\"m36.21,67.9c-10,0-18.11-8.11-18.11-18.11s8.11-18.11,18.11-18.11c5,0,9.53,2.03,12.8,5.3l12.8-12.8c-6.55-6.55-15.61-10.61-25.61-10.61C16.21,13.58,0,29.79,0,49.79s16.21,36.21,36.21,36.21c10,0,19.05-4.05,25.61-10.61l-12.8-12.8c-3.28,3.28-7.8,5.3-12.8,5.3Z\"/>\n          <polygon class=\"cls-1\" points=\"181.06 58.84 181.06 86 126.74 86 135.79 67.9 162.95 67.9 135.79 40.74 135.79 13.58 190.11 13.58 181.06 31.69 153.9 31.82 181.06 58.84\"/>\n          <polygon class=\"cls-1\" points=\"67.9 13.58 67.9 86 86 67.9 86 49.79 86 31.69 104.11 31.69 86 49.79 122.21 86 122.21 58.84 113.16 49.79 122.21 40.74 122.21 31.69 122.21 13.58 67.9 13.58\"/>\n        </g>\n        <g>\n          <polygon class=\"cls-1\" points=\"353.06 58.84 353.06 86 298.75 86 307.8 67.9 334.96 67.9 307.8 40.74 307.8 13.58 362.12 13.58 353.06 31.69 325.9 31.82 353.06 58.84\"/>\n          <polygon class=\"cls-1\" points=\"208.22 13.58 235.1 49.79 208.22 86 235.38 86 262.53 49.79 235.38 13.58 208.22 13.58\"/>\n          <polygon class=\"cls-1\" points=\"271.59 13.58 271.59 76.95 282.9 95.06 282.9 95.05 282.9 95.06 294.22 76.95 294.22 13.58 271.59 13.58\"/>\n          <polygon class=\"cls-1\" points=\"380.22 67.9 380.22 58.84 398.33 58.84 398.33 40.74 380.22 40.74 380.22 31.69 398.33 31.69 416.43 13.58 362.12 13.58 362.12 86 416.43 86 398.33 67.9 380.22 67.9\"/>\n          <polygon class=\"cls-1\" points=\"416.43 95.06 416.43 13.58 434.54 13.58 452.64 49.79 452.64 22.63 470.75 4.53 470.75 86 452.64 86 434.54 49.79 434.54 76.95 416.43 95.06\"/>\n          <polygon class=\"cls-1\" points=\"425.49 9.05 461.7 9.05 452.64 0 416.43 0 425.49 9.05\"/>\n          <path class=\"cls-1\" d=\"m516.01,13.58c-20,0-36.21,16.21-36.21,36.21s16.21,36.21,36.21,36.21,36.21-16.21,36.21-36.21-16.21-36.21-36.21-36.21Zm0,54.32c-10,0-18.11-8.11-18.11-18.11s8.11-18.11,18.11-18.11,18.11,8.11,18.11,18.11-8.11,18.11-18.11,18.11Z\"/>\n        </g>\n      </g>\n      <path class=\"cls-1\" d=\"m0,104.11h552.23v3.49H0v-3.49Z\"/>\n      <g>\n        <path class=\"cls-1\" d=\"m0,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24H0Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04H3.06v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m21.55,135.34v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m31.31,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m51.7,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m81.91,124.56h-8.23v8.31h8.23v-2.82l3.05.63v1.55c0,1.2-.23,2.02-.68,2.45s-1.31.65-2.58.65h-7.84c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h7.84c1.27,0,2.13.22,2.58.66.45.44.68,1.25.68,2.45v1.24l-3.05.48v-2.48Z\"/>\n        <path class=\"cls-1\" d=\"m97.38,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m106.89,125.32c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h9.66c1.27,0,2.14.22,2.58.66.45.44.67,1.25.67,2.45v6.92c0,1.2-.22,2.02-.67,2.45-.45.43-1.31.65-2.58.65h-9.66c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92Zm3.05,7.55h10.07v-8.31h-10.07v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m129.49,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m159.73,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24h-7.66Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04h-5.41v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m181.28,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m207.82,135.34l7.43-13.13h2.94l7.53,13.13h-3.43l-1.58-2.87h-8.32l-1.53,2.87h-3.04Zm5.87-5.24h5.75l-2.83-5.34-2.92,5.34Z\"/>\n        <path class=\"cls-1\" d=\"m229.93,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m255.99,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m265.77,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m298.77,115.91v25.43h-1.86v-25.43h1.86Z\"/>\n        <path class=\"cls-1\" d=\"m317.39,135.34v-13.13h3.06v10.66h9.85v2.47h-12.9Z\"/>\n        <path class=\"cls-1\" d=\"m334.46,120.82l2.53-4.3h2.76l-3.66,4.3h-1.63Zm.3,14.52v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m344.52,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24h-7.66Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04h-5.41v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m366.07,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m385.27,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m426.52,124.56h-8.23v8.31h8.23v-2.82l3.05.63v1.55c0,1.2-.23,2.02-.68,2.45s-1.31.65-2.58.65h-7.84c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h7.84c1.27,0,2.13.22,2.58.66.45.44.68,1.25.68,2.45v1.24l-3.05.48v-2.48Z\"/>\n        <path class=\"cls-1\" d=\"m435.87,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m456.27,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m472.96,135.34l7.43-13.13h2.94l7.53,13.13h-3.43l-1.58-2.87h-8.32l-1.53,2.87h-3.04Zm5.87-5.24h5.75l-2.83-5.34-2.92,5.34Z\"/>\n        <path class=\"cls-1\" d=\"m499.46,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m509.25,135.34v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m523.44,135.34l-7.59-13.13h3.49l5.31,9.49,5.07-9.49h3.04l-7.22,13.13h-2.11Z\"/>\n        <path class=\"cls-1\" d=\"m536.06,125.32c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h9.66c1.27,0,2.14.22,2.58.66.45.44.67,1.25.67,2.45v6.92c0,1.2-.22,2.02-.67,2.45-.45.43-1.31.65-2.58.65h-9.66c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92Zm3.05,7.55h10.07v-8.31h-10.07v8.31Z\"/>\n      </g>\n    </g>\n  </g>\n</svg>","blanco":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"Capa_2\" data-name=\"Capa 2\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 552.23 141.34\">\n  <defs>\n    <style>\n      .cls-1 {\n        fill: #fff;\n      }\n    </style>\n  </defs>\n  <g id=\"Vectores\">\n    <g>\n      <g>\n        <g>\n          <path class=\"cls-1\" d=\"m36.21,67.9c-10,0-18.11-8.11-18.11-18.11s8.11-18.11,18.11-18.11c5,0,9.53,2.03,12.8,5.3l12.8-12.8c-6.55-6.55-15.61-10.61-25.61-10.61C16.21,13.58,0,29.79,0,49.79s16.21,36.21,36.21,36.21c10,0,19.05-4.05,25.61-10.61l-12.8-12.8c-3.28,3.28-7.8,5.3-12.8,5.3Z\"/>\n          <polygon class=\"cls-1\" points=\"181.06 58.84 181.06 86 126.74 86 135.79 67.9 162.95 67.9 135.79 40.74 135.79 13.58 190.11 13.58 181.06 31.69 153.9 31.82 181.06 58.84\"/>\n          <polygon class=\"cls-1\" points=\"67.9 13.58 67.9 86 86 67.9 86 49.79 86 31.69 104.11 31.69 86 49.79 122.21 86 122.21 58.84 113.16 49.79 122.21 40.74 122.21 31.69 122.21 13.58 67.9 13.58\"/>\n        </g>\n        <g>\n          <polygon class=\"cls-1\" points=\"353.06 58.84 353.06 86 298.75 86 307.8 67.9 334.96 67.9 307.8 40.74 307.8 13.58 362.12 13.58 353.06 31.69 325.9 31.82 353.06 58.84\"/>\n          <polygon class=\"cls-1\" points=\"208.22 13.58 235.1 49.79 208.22 86 235.38 86 262.53 49.79 235.38 13.58 208.22 13.58\"/>\n          <polygon class=\"cls-1\" points=\"271.59 13.58 271.59 76.95 282.9 95.06 282.9 95.05 282.9 95.06 294.22 76.95 294.22 13.58 271.59 13.58\"/>\n          <polygon class=\"cls-1\" points=\"380.22 67.9 380.22 58.84 398.33 58.84 398.33 40.74 380.22 40.74 380.22 31.69 398.33 31.69 416.43 13.58 362.12 13.58 362.12 86 416.43 86 398.33 67.9 380.22 67.9\"/>\n          <polygon class=\"cls-1\" points=\"416.43 95.06 416.43 13.58 434.54 13.58 452.64 49.79 452.64 22.63 470.75 4.53 470.75 86 452.64 86 434.54 49.79 434.54 76.95 416.43 95.06\"/>\n          <polygon class=\"cls-1\" points=\"425.49 9.05 461.7 9.05 452.64 0 416.43 0 425.49 9.05\"/>\n          <path class=\"cls-1\" d=\"m516.01,13.58c-20,0-36.21,16.21-36.21,36.21s16.21,36.21,36.21,36.21,36.21-16.21,36.21-36.21-16.21-36.21-36.21-36.21Zm0,54.32c-10,0-18.11-8.11-18.11-18.11s8.11-18.11,18.11-18.11,18.11,8.11,18.11,18.11-8.11,18.11-18.11,18.11Z\"/>\n        </g>\n      </g>\n      <path class=\"cls-1\" d=\"m0,104.11h552.23v3.49H0v-3.49Z\"/>\n      <g>\n        <path class=\"cls-1\" d=\"m0,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24H0Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04H3.06v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m21.55,135.34v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m31.31,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m51.7,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m81.91,124.56h-8.23v8.31h8.23v-2.82l3.05.63v1.55c0,1.2-.23,2.02-.68,2.45s-1.31.65-2.58.65h-7.84c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h7.84c1.27,0,2.13.22,2.58.66.45.44.68,1.25.68,2.45v1.24l-3.05.48v-2.48Z\"/>\n        <path class=\"cls-1\" d=\"m97.38,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m106.89,125.32c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h9.66c1.27,0,2.14.22,2.58.66.45.44.67,1.25.67,2.45v6.92c0,1.2-.22,2.02-.67,2.45-.45.43-1.31.65-2.58.65h-9.66c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92Zm3.05,7.55h10.07v-8.31h-10.07v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m129.49,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m159.73,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24h-7.66Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04h-5.41v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m181.28,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m207.82,135.34l7.43-13.13h2.94l7.53,13.13h-3.43l-1.58-2.87h-8.32l-1.53,2.87h-3.04Zm5.87-5.24h5.75l-2.83-5.34-2.92,5.34Z\"/>\n        <path class=\"cls-1\" d=\"m229.93,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m255.99,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m265.77,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m298.77,115.91v25.43h-1.86v-25.43h1.86Z\"/>\n        <path class=\"cls-1\" d=\"m317.39,135.34v-13.13h3.06v10.66h9.85v2.47h-12.9Z\"/>\n        <path class=\"cls-1\" d=\"m334.46,120.82l2.53-4.3h2.76l-3.66,4.3h-1.63Zm.3,14.52v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m344.52,135.34v-13.13h8.44c2.41,0,4.26.56,5.56,1.69,1.3,1.13,1.94,2.72,1.94,4.79,0,1.23-.25,2.33-.76,3.31-.5.98-1.22,1.75-2.14,2.32-.57.36-1.28.62-2.13.78s-1.94.24-3.26.24h-7.66Zm3.06-2.47h3.95c2.1,0,3.59-.33,4.47-.98.88-.65,1.32-1.73,1.32-3.24,0-1.34-.36-2.36-1.09-3.05-.73-.69-1.81-1.04-3.23-1.04h-5.41v8.31Z\"/>\n        <path class=\"cls-1\" d=\"m366.07,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m385.27,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m426.52,124.56h-8.23v8.31h8.23v-2.82l3.05.63v1.55c0,1.2-.23,2.02-.68,2.45s-1.31.65-2.58.65h-7.84c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h7.84c1.27,0,2.13.22,2.58.66.45.44.68,1.25.68,2.45v1.24l-3.05.48v-2.48Z\"/>\n        <path class=\"cls-1\" d=\"m435.87,135.34v-13.13h11.23c1.04,0,1.8.2,2.27.6s.7,1.05.7,1.94v3.08c0,.89-.23,1.53-.7,1.94s-1.22.61-2.27.61h-1.71l6.06,4.96h-4.38l-5.29-4.96h-2.89v4.96h-3.01Zm9.87-10.85h-6.87v3.65h6.87c.53,0,.89-.08,1.09-.23.19-.15.29-.42.29-.81v-1.58c0-.38-.1-.65-.29-.8-.19-.15-.56-.23-1.09-.23Z\"/>\n        <path class=\"cls-1\" d=\"m456.27,135.34v-13.13h13.44v2.24h-10.38v2.93h6.06v2.24h-6.06v3.25h10.51v2.47h-13.56Z\"/>\n        <path class=\"cls-1\" d=\"m472.96,135.34l7.43-13.13h2.94l7.53,13.13h-3.43l-1.58-2.87h-8.32l-1.53,2.87h-3.04Zm5.87-5.24h5.75l-2.83-5.34-2.92,5.34Z\"/>\n        <path class=\"cls-1\" d=\"m499.46,124.56v10.78h-3.05v-10.78h-6.02v-2.35h15.13v2.35h-6.05Z\"/>\n        <path class=\"cls-1\" d=\"m509.25,135.34v-13.13h3.06v13.13h-3.06Z\"/>\n        <path class=\"cls-1\" d=\"m523.44,135.34l-7.59-13.13h3.49l5.31,9.49,5.07-9.49h3.04l-7.22,13.13h-2.11Z\"/>\n        <path class=\"cls-1\" d=\"m536.06,125.32c0-1.19.22-2.01.67-2.45.45-.44,1.31-.66,2.58-.66h9.66c1.27,0,2.14.22,2.58.66.45.44.67,1.25.67,2.45v6.92c0,1.2-.22,2.02-.67,2.45-.45.43-1.31.65-2.58.65h-9.66c-1.27,0-2.14-.22-2.58-.65s-.67-1.25-.67-2.45v-6.92Zm3.05,7.55h10.07v-8.31h-10.07v8.31Z\"/>\n      </g>\n    </g>\n  </g>\n</svg>"};
/* LOGO-INLINE-END */

/** Descarga un SVG del host del plugin. Solo es el último recurso. */
async function fetchSvg(file) {
  try {
    if (typeof fetch !== 'function') return null;
    const res = await fetch(file, { cache: 'no-store' });
    if (!res || !res.ok) return null;
    const text = await res.text();
    return (text && text.indexOf('<svg') !== -1) ? text : null;
  } catch (e) {
    return null;
  }
}

/**
 * Reúne los tres SVG oficiales. Orden de preferencia:
 *   1. el que arrastró el usuario (ocupa el lugar de la variante color),
 *   2. el texto embebido en el plugin,
 *   3. la descarga desde el host del plugin.
 */
async function loadLogos() {
  const out = {};
  const arrastrado = LOGO_RECIBIDO && LOGO_RECIBIDO.svg ? LOGO_RECIBIDO.svg : null;

  function resolver(variante) {
    const inline = LOGO_SVG_INLINE && LOGO_SVG_INLINE[variante];
    if (inline && inline.indexOf('<svg') !== -1) return inline;
    return null;
  }

  out.color = arrastrado || resolver('color') || await fetchSvg(LOGO_FILES.color);
  out.negro = resolver('negro') || await fetchSvg(LOGO_FILES.negro);
  out.blanco = resolver('blanco') || await fetchSvg(LOGO_FILES.blanco);

  out.origen = arrastrado ? 'arrastrado'
    : (out.color ? 'embebido en el plugin' : 'sin archivo');
  out.variantes = ['color', 'negro', 'blanco'].filter(function (k) { return !!out[k]; }).join(',');
  return out;
}

/** Lee el `viewBox` de un SVG y devuelve su proporcion ancho/alto. */
function svgRatio(svgText, porDefecto) {
  try {
    const m = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(svgText);
    if (m) {
      const w = parseFloat(m[1]);
      const h = parseFloat(m[2]);
      if (w > 0 && h > 0) return w / h;
    }
  } catch (e) { /* proporcion por defecto */ }
  return porDefecto || 1;
}

/**
 * Importa un SVG como forma de Penpot AJUSTANDOLO a una caja sin deformarlo.
 * v11: el tamaño se calcula con la proporcion real del `viewBox`; antes se
 * forzaba 0,38 de alto y el logotipo (3,9 a 1) salía aplastado.
 */
function svgShape(svgText, name, cajaW, cajaH) {
  if (!svgText) return null;
  if (!P || typeof P.createShapeFromSvg !== 'function') return null;
  try {
    const shape = P.createShapeFromSvg(svgText);
    if (!shape) return null;
    shape.name = safeName(name, 'Logotipo');

    const ratio = svgRatio(svgText, 3.9);
    const maxW = cajaW || 300;
    const maxH = cajaH || Math.round(maxW / ratio);

    // Escala que quepa en la caja conservando la proporcion.
    let w = maxW;
    let h = Math.round(w / ratio);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h * ratio);
    }

    try { shape.resize(w, h); } catch (e) { /* se queda con el tamaño del SVG */ }
    return shape;
  } catch (e) {
    try { console.warn('[CRS Penpot] No se pudo importar el SVG', name, e); } catch (e2) { /* ignore */ }
    return null;
  }
}

/**
 * Panel de una variante del logotipo: fondo, logotipo importado y rótulo de
 * uso. v11: el logo se ajusta a la caja SIN deformarse y el respaldo ya no
 * mete el nombre dentro de una caja estrecha (antes salía cortado).
 */
function logoPanel(svgText, nombre, fondo, colorRotulo, uso, ancho, alto) {
  // Margen interior para que el logo respire dentro del panel.
  const cajaLogoW = ancho - 56;
  const cajaLogoH = alto - 48;
  const logo = svgShape(svgText, 'logotipo / ' + nombre, cajaLogoW, cajaLogoH);

  const dentro = logo ? [logo] : [
    markGt(Math.round(alto * 0.34), colorRotulo, WEIGHT.black),
    text('CRS DISEÑO', {
      name: 'respaldo / nombre',
      size: 15,
      font: font(WEIGHT.black),
      color: colorRotulo,
      letterSpacing: TRACK.wide,
      lineHeight: '1.1',
    }),
  ];

  const caja = container('logotipo / ' + nombre, {
    w: ancho, h: alto, dir: 'column', gap: 8, align: 'center', justify: 'center',
  }, dentro);
  try { caja.fills = [solid(fondo)]; } catch (e) { /* fondo opcional */ }
  try { caja.strokes = [stroke(COLOR.textPrimary, 0.12, 1)]; } catch (e) { /* borde opcional */ }

  return container('variante / ' + nombre, {
    w: ancho + 2, h: alto + 46, dir: 'column', gap: 0, align: 'start', justify: 'start',
  }, [
    caja,
    container('rotulo / ' + nombre, {
      w: ancho + 2, h: 46, dir: 'column', gap: 4, align: 'start', justify: 'center',
    }, [
      label(nombre.toUpperCase(), { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
      text(uso, {
        name: 'uso / ' + nombre,
        size: 12,
        font: font(WEIGHT.regular),
        color: COLOR.textSecondary,
        letterSpacing: '0.01',
        lineHeight: '1.3',
      }),
    ]),
  ]);
}

/**
 * Lista de reglas de uso con viñeta ">".
 * v11: cada fila mide lo que necesita el texto y el texto NO lleva ancho fijo,
 * porque al fijarlo se cortaba a la primera palabra en el runtime real.
 */
function reglasLista(width, reglas) {
  const ALTO = 34;
  const SEPARACION = 6;

  const filas = reglas.map(function (r, i) {
    // La viñeta es la forma real del símbolo del logotipo, no un signo escrito
    // con la fuente. Si el runtime no importa SVG, se cae al glifo.
    const vineta = brandMark('chevron', COLOR.blue, 11, 14) || markGt(13, COLOR.blue, WEIGHT.black);
    return container('regla / ' + pad2(i + 1), {
      w: width, h: ALTO, dir: 'row', gap: 12, align: 'center', justify: 'start',
    }, [
      container('vineta / ' + pad2(i + 1), {
        w: 16, h: ALTO, dir: 'row', gap: 0, align: 'center', justify: 'start',
      }, [vineta]),
      text(r, {
        name: 'regla texto / ' + pad2(i + 1),
        size: 14,
        font: font(WEIGHT.regular),
        color: COLOR.textPrimary,
        letterSpacing: '0.01',
        lineHeight: '1.3',
      }),
    ]);
  });

  return container('reglas de uso', {
    w: width,
    h: reglas.length * ALTO + (reglas.length - 1) * SEPARACION,
    dir: 'column', gap: SEPARACION, align: 'start', justify: 'start',
  }, filas);
}

// -----------------------------------------------------------------------------
// 5.c PIEZAS DE MARCA (v12). El símbolo ">" y la "i" NO se escriben con una
//     fuente: son las formas del logotipo oficial, con sus cortes a 45 grados.
//     Las coordenadas salen tal cual del SVG (logo-full.svg), así que la firma
//     de la marca no se reinterpreta nunca. Cada pieza se puede recolorear
//     porque el color se incorpora al SVG antes de importarlo.
// -----------------------------------------------------------------------------

const BRAND_SHAPES = {
  chevron: {
    nombre: 'simbolo >',
    viewBox: '208.22 13.58 54.31 72.42',
    points: '208.22,13.58 235.1,49.79 208.22,86 235.38,86 262.53,49.79 235.38,13.58',
    nota: 'Cierre de etiqueta HTML: dos trazos a 45 grados con remate abierto.',
    uso: 'Viñeta de listas con elementos importantes y cierre de bloques.',
  },
  playhead: {
    nombre: 'playhead i',
    viewBox: '271.59 13.58 22.63 81.48',
    points: '271.59,13.58 271.59,76.95 282.9,95.06 294.22,76.95 294.22,13.58',
    nota: 'La i de la marca: barra con punta inferior, playhead o lápiz.',
    uso: 'Indicador de paso activo y de progreso.',
  },
  cinta: {
    nombre: 'cinta con muesca',
    viewBox: '0 0 120 36',
    points: '0,0 120,0 104,18 120,36 0,36',
    nota: 'Cinta con muesca en V, corte a 45 grados.',
    uso: 'Etiquetas y cintas de estado.',
  },
  paralelogramo: {
    nombre: 'paralelogramo',
    viewBox: '0 0 120 36',
    points: '12,0 120,0 108,36 0,36',
    nota: 'Paralelogramo con corte diagonal, inclinación de marca.',
    uso: 'Pestañas, separadores y pestañas activas.',
  },
};

/**
 * SVG de una pieza de marca con el color y la opacidad incorporados al propio
 * archivo. La opacidad va en el fill porque el color no se puede recolorear
 * después: el SVG se importa con su relleno ya resuelto.
 */
function brandSvg(kind, color, opacity) {
  const b = BRAND_SHAPES[kind];
  if (!b) return null;
  const op = (opacity == null) ? 1 : opacity;
  const fillOp = op < 1 ? ' fill-opacity="' + op + '"' : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + b.viewBox + '">' +
    '<polygon fill="' + (color || COLOR.blue) + '"' + fillOp + ' points="' + b.points + '"/></svg>';
}

/**
 * Cota horizontal con la medida. La LINEA mide exactamente el ancho de la
 * pieza; la etiqueta tiene su propia caja mas ancha para no quedar recortada
 * cuando la pieza es pequena (un chevron de 12 px, por ejemplo).
 */
function cotaMedida(ancho, etiqueta) {
  // v21: la caja de la cota es lo bastante ancha para la etiqueta. Antes se
  // ajustaba al ancho de la pieza y la etiqueta quedaba cortada por los lados
  // ("32 px" se leia "2 px").
  const anchoCaja = Math.max(ancho + 28, 68);
  const lineaW = Math.max(8, ancho - 2);
  return container('cota / ' + etiqueta, {
    w: anchoCaja, h: 30, dir: 'column', gap: 4, align: 'center', justify: 'end',
  }, [
    text(etiqueta, {
      name: 'medida / ' + etiqueta, size: 10, font: font(WEIGHT.bold),
      color: COLOR.textSecondary, letterSpacing: '0.04', lineHeight: '1.1',
      w: anchoCaja, align: 'center',
    }),
    container('cota / linea ' + etiqueta, {
      w: ancho, h: 9, dir: 'row', gap: 0, align: 'center', justify: 'space-between',
    }, [
      rect('tope izq / ' + etiqueta, 1, 9, COLOR.blue),
      rect('linea de cota / ' + etiqueta, lineaW, 1, COLOR.blue),
      rect('tope der / ' + etiqueta, 1, 9, COLOR.blue),
    ]),
  ]);
}
/**
 * Coloca una pieza de marca ajustada a una caja, sin deformarla, con la
 * opacidad que se pida. Si el runtime no puede importar SVG, devuelve null y
 * quien llama decide el respaldo.
 */
/**
 * Icono genérico de columna para los pilares. v25: se dibuja como SVG porque
 * los rectángulos sueltos dentro de un contenedor no se pintaban en el runtime
 * real. Es el mismo recurso que sí funciona con las piezas de marca.
 */
function iconoColumna(alto) {
  // Columna simétrica: capitel, fuste y basa en el MISMO azul de marca.
  // v27: un solo color, como pidió el usuario; antes capitel y basa iban en el
  // azul profundo y el fuste en el azul principal.
  const h = Math.max(16, Math.round(alto || 28));
  const ancho = Math.round(h * 0.75);
  const capitelH = Math.max(2, Math.round(h * 0.12));
  const basaH = Math.max(2, Math.round(h * 0.12));
  const fusteH = h - capitelH - basaH;
  const fusteW = Math.round(ancho * 0.55);
  const eje = Math.round((ancho - fusteW) / 2);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ancho + ' ' + h + '">' +
    '<rect x="0" y="0" width="' + ancho + '" height="' + capitelH + '" fill="' + COLOR.blue + '"/>' +
    '<rect x="' + eje + '" y="' + capitelH + '" width="' + fusteW + '" height="' + fusteH + '" fill="' + COLOR.blue + '"/>' +
    '<rect x="0" y="' + (h - basaH) + '" width="' + ancho + '" height="' + basaH + '" fill="' + COLOR.blue + '"/>' +
    '</svg>';
  return svgShape(svg, 'icono / columna', ancho, h);
}
function brandMark(kind, color, cajaW, cajaH, opacity) {
  const b = BRAND_SHAPES[kind];
  return svgShape(brandSvg(kind, color, opacity), b ? b.nombre : 'pieza', cajaW, cajaH);
}
/** Celda de pieza de marca: la pieza sobre fondo neutro, con nombre y uso. */
function celdaPieza(kind, color, fondo, cajaW, ancho, alto) {
  const pieza = brandMark(kind, color, cajaW, cajaW);
  const b = BRAND_SHAPES[kind];

  const marco = container('pieza / ' + b.nombre, {
    w: ancho, h: alto, dir: 'column', gap: 6, align: 'center', justify: 'center',
  }, pieza ? [pieza] : [markGt(28, color, WEIGHT.black)]);
  try { marco.fills = [solid(fondo || COLOR.white)]; } catch (e) { /* opcional */ }
  try { marco.strokes = [stroke(COLOR.textPrimary, 0.12, 1)]; } catch (e) { /* opcional */ }

  return container('bloque / ' + b.nombre, {
    w: ancho + 2, h: alto + 62, dir: 'column', gap: 8, align: 'start', justify: 'start',
  }, [
    marco,
    label(kind.toUpperCase(), { size: 10, color: COLOR.blue, letterSpacing: TRACK.wider }),
    text(b.uso, {
      name: 'uso / ' + b.nombre,
      size: 11,
      font: font(WEIGHT.regular),
      color: COLOR.textSecondary,
      letterSpacing: '0.01',
      lineHeight: '1.3',
    }),
  ]);
}

/**
 * 02 / MARCA
 * Las seis piezas aprobadas por el usuario: variantes del logotipo, símbolo y
 * playhead aislados con su área de respeto y tamaños mínimos, reglas de uso,
 * usos incorrectos, fondos permitidos y las formas del logo como recursos.
 * El logotipo entra por arrastre desde la ventana del plugin.
 */
function buildMarca(board, section) {
  const W = section.width || BOARD_W;
  const cw = W - PAD * 2;
  const logos = LOGOS || {};

  const gradientOk = paintBoard(board, COLOR.blue50);
  try { console.log('[CRS] gradiente nativo=' + gradientOk); } catch (e) { /* opcional */ }

  const cabecera = topBlock(cw, 'SISTEMA DE DISEÑO 1.12');

  const bajada = container('bajada', {
    w: cw, h: 18, dir: 'row', gap: 24, align: 'center', justify: 'space-between',
  }, [
    label('LOGOTIPO, SÍMBOLO, PLAYHEAD Y REGLAS DE USO', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    label('SECCIÓN 01', { size: 11, color: COLOR.textMuted, letterSpacing: TRACK.wider }),
  ]);

  const encabezado = container('encabezado', {
    w: cw, h: 101, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [
    text('MARCA', {
      name: 'titular / marca',
      size: 56,
      font: font(WEIGHT.black),
      color: COLOR.textPrimary,
      letterSpacing: TRACK.display,
      lineHeight: '1.05',
    }),
    bajada,
    hairline('filete de encabezado', cw, COLOR.textPrimary, 0.10),
  ]);

  // 1) Las tres variantes del logotipo.
  const anchoPanel = Math.floor((cw - 2 * 24) / 3);
  const alturaPanel = 132;

  const variantes = container('variantes del logotipo', {
    w: cw, h: alturaPanel + 46, dir: 'row', gap: 24, align: 'start', justify: 'start',
  }, [
    logoPanel(logos.color, 'color', COLOR.white, COLOR.blue,
      'Uso por defecto en menús y cabeceras.', anchoPanel, alturaPanel),
    logoPanel(logos.negro, 'negro', COLOR.bgBase, COLOR.textPrimary,
      'Fondos claros donde el color no contrasta.', anchoPanel, alturaPanel),
    logoPanel(logos.blanco, 'blanco', COLOR.blue900, COLOR.white,
      'Fondos oscuros, azul profundo o fotografía.', anchoPanel, alturaPanel),
  ]);

  // 2) Símbolo y playhead AISLADOS, tamaños mínimos A TAMAÑO REAL y área de
  //    respeto visible, acotada y con retícula de referencia.
  const anchoPieza = Math.floor((cw - 2 * 24) / 3);

  const simbolo = celdaPieza('chevron', COLOR.blue, COLOR.white, 96, anchoPieza, 150);
  const playhead = celdaPieza('playhead', COLOR.blue, COLOR.white, 96, anchoPieza, 150);

  // TAMAÑOS MÍNIMOS (v20): cota del ancho exacto de cada pieza, alto calculado
  // por proporción para que nada se recorte, y el símbolo con sus dos medidas
  // de favicon.
  const RATIO_LOGO = 3.907;
  const ANCHO_LOGO_MIN = 150;
  const ALTO_LOGO_MIN = Math.round(ANCHO_LOGO_MIN / RATIO_LOGO);

  const logoMin = svgShape(logos.color, 'logotipo / minimo 150 px', ANCHO_LOGO_MIN, ALTO_LOGO_MIN + 24)
    || markGt(ALTO_LOGO_MIN, COLOR.blue);

  const chevronMin = function (alto) {
    return brandMark('chevron', COLOR.blue, Math.round(alto * 0.75), alto) || markGt(alto, COLOR.blue);
  };

  const specimenMin = function (pieza, etiqueta, ancho, alto) {
    const cajaW = Math.max(ancho + 28, 68);
    return container('specimen / ' + etiqueta, {
      w: cajaW, h: 30 + 6 + alto, dir: 'column', gap: 6, align: 'center', justify: 'start',
    }, [
      cotaMedida(ancho, etiqueta),
      container('pieza / ' + etiqueta, {
        w: cajaW, h: alto, dir: 'row', gap: 0, align: 'center', justify: 'center',
      }, [pieza]),
    ]);
  };

  const cotaLogo = specimenMin(logoMin, ANCHO_LOGO_MIN + ' px', ANCHO_LOGO_MIN, ALTO_LOGO_MIN);
  const icono32 = specimenMin(chevronMin(32), '32 px', 24, 32);
  const icono16 = specimenMin(chevronMin(16), '16 px', 12, 16);

  const filaIconos = container('favicon / fila', {
    w: anchoPieza, h: 30 + 6 + 32, dir: 'row', gap: 28, align: 'start', justify: 'start',
  }, [icono32, icono16]);

  const minimos = container('tamanos minimos', {
    w: anchoPieza, h: 268, dir: 'column', gap: 10, align: 'start', justify: 'start',
  }, [
    label('TAMAÑOS MÍNIMOS', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    cotaLogo,
    label('SÍMBOLO COMO FAVICON', { size: 10, color: COLOR.blue, letterSpacing: TRACK.wider }),
    filaIconos,
    text('Por debajo de 150 px el logotipo no se reduce: se usa el símbolo solo. En pestaña, entre 16 y 32 px.', {
      name: 'minimo / nota', size: 10, font: font(WEIGHT.regular),
      color: COLOR.textSecondary, letterSpacing: '0.01', lineHeight: '1.3',
    }),
  ]);

  const piezas = container('piezas de marca', {
    w: cw, h: 268, dir: 'row', gap: 24, align: 'start', justify: 'start',
  }, [simbolo, playhead, minimos]);

  // ÁREA DE RESPETO (v20), según las correcciones del usuario:
  //   - sin caja blanca alrededor del logotipo,
  //   - el símbolo pegado al logotipo en los cuatro lados, sin espacio,
  //   - el símbolo al MISMO tamaño que el que va dentro del logo, solo con 50
  //     por ciento de opacidad,
  //   - una línea azul que encierra toda la composición.
  // X es la proporción MAYOR del símbolo: si es más alto que ancho se toma el
  // alto; si es más ancho que alto, el ancho. En la v2.0 el cliente dirá qué
  // elemento de su logo hace de X.
  const LOGO_W = 460;
  const LOGO_H = Math.round(LOGO_W / RATIO_LOGO);
  const ESCALA_LOGO = LOGO_W / 552.23;                 // viewBox oficial
  const CHEV_W = Math.round(54.31 * ESCALA_LOGO);      // ancho del chevron del logo
  const CHEV_H = Math.round(72.42 * ESCALA_LOGO);      // alto del chevron del logo
  const X_RESPETO = Math.max(CHEV_W, CHEV_H);          // 45 contra 60: X = 60
  const COMP_W = LOGO_W + CHEV_W * 2;
  const COMP_H = LOGO_H + CHEV_H * 2;

  const logoRespeto = svgShape(logos.color, 'logotipo / area de respeto', LOGO_W, LOGO_H) || markGt(60, COLOR.blue);

  const chevronRespeto = function () {
    return brandMark('chevron', COLOR.blue, CHEV_W, CHEV_H, 0.5) || markGt(CHEV_H, COLOR.blue);
  };

  const filaCentro = container('respeto / centro', {
    w: COMP_W, h: LOGO_H, dir: 'row', gap: 0, align: 'center', justify: 'space-between',
  }, [
    container('respeto / izquierda', { w: CHEV_W, h: LOGO_H, dir: 'row', align: 'center', justify: 'center' }, [chevronRespeto()]),
    container('respeto / logotipo', { w: LOGO_W, h: LOGO_H, dir: 'row', align: 'center', justify: 'center' }, [logoRespeto]),
    container('respeto / derecha', { w: CHEV_W, h: LOGO_H, dir: 'row', align: 'center', justify: 'center' }, [chevronRespeto()]),
  ]);

  // pad: 0 explicito. La caja lleva borde, y por defecto una caja visible
  // recibe relleno interior: eso desplazaria los chevrones y recortaria la fila.
  const composicion = container('area de respeto / composicion', {
    w: COMP_W, h: COMP_H, dir: 'column', gap: 0, align: 'center', justify: 'start', pad: 0,
  }, [
    container('respeto / arriba', { w: COMP_W, h: CHEV_H, dir: 'row', align: 'center', justify: 'center' }, [chevronRespeto()]),
    filaCentro,
    container('respeto / abajo', { w: COMP_W, h: CHEV_H, dir: 'row', align: 'center', justify: 'center' }, [chevronRespeto()]),
  ]);
  // La línea azul que delimita el área de respeto.
  try { composicion.strokes = [stroke(COLOR.blue, 1, 2)]; } catch (e) { /* opcional */ }
  try { composicion.fills = []; } catch (e) { /* sin relleno */ }

  // Leyenda del diagrama, en el espacio libre de la derecha. Explica qué es
  // cada pieza del dibujo y de dónde sale X.
  const leyendaW = cw - COMP_W - 32;

  const itemLeyenda = function (n, titulo, detalle) {
    return container('leyenda / ' + pad2(n), {
      w: leyendaW, h: 46, dir: 'row', gap: 12, align: 'start', justify: 'start',
    }, [
      container('vineta / ' + pad2(n), {
        w: 16, h: 46, dir: 'row', gap: 0, align: 'center', justify: 'start',
      }, [brandMark('chevron', COLOR.blue, 11, 14) || markGt(14, COLOR.blue)]),
      container('texto / ' + pad2(n), {
        w: leyendaW - 28, h: 46, dir: 'column', gap: 2, align: 'start', justify: 'center',
      }, [
        text(titulo, {
          name: 'leyenda titulo / ' + pad2(n), size: 12, font: font(WEIGHT.bold),
          color: COLOR.textPrimary, letterSpacing: '0.01', lineHeight: '1.25',
        }),
        text(detalle, {
          name: 'leyenda detalle / ' + pad2(n), size: 11, font: font(WEIGHT.regular),
          color: COLOR.textSecondary, letterSpacing: '0.01', lineHeight: '1.3',
        }),
      ]),
    ]);
  };

  const leyenda = container('leyenda / area de respeto', {
    w: leyendaW, h: COMP_H, dir: 'column', gap: 10, align: 'start', justify: 'start',
  }, [
    label('CÓMO SE LEE EL DIAGRAMA', { size: 10, color: COLOR.blue, letterSpacing: TRACK.wider }),
    itemLeyenda(1, 'Logotipo oficial', 'El mismo de las tres variantes, sin recortes ni márgenes añadidos.'),
    itemLeyenda(2, 'Símbolo del logo con 50 por ciento de opacidad', 'Va pegado a cada lado, al mismo tamaño que el del logotipo, y ocupa la distancia X que debe quedar libre.'),
    itemLeyenda(3, 'Línea azul', 'Delimita el área de respeto completa de la composición.'),
    text('Logo ' + LOGO_W + ' x ' + LOGO_H + ' px, símbolo ' + CHEV_W + ' x ' + CHEV_H + ' px, X = ' + X_RESPETO + ' px.', {
      name: 'leyenda / medidas', size: 11, font: font(WEIGHT.bold),
      color: COLOR.blue, letterSpacing: '0.02', lineHeight: '1.3',
    }),
    text('En la versión 2.0 el cliente indicará qué elemento de su logo hace de X.', {
      name: 'leyenda / nota', size: 11, font: font(WEIGHT.regular),
      color: COLOR.textMuted, letterSpacing: '0.01', lineHeight: '1.3',
    }),
  ]);

  const filaRespetoTotal = container('area de respeto / bloque', {
    w: cw, h: COMP_H, dir: 'row', gap: 32, align: 'start', justify: 'start',
  }, [composicion, leyenda]);

  const bloqueRespeto = container('bloque / area de respeto', {
    w: cw, h: 26 + 12 + COMP_H, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [
    label('ÁREA DE RESPETO: LA DISTANCIA LIBRE ES LA PROPORCIÓN MAYOR DEL SÍMBOLO', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    filaRespetoTotal,
  ]);
  // 3) Reglas de uso, con el playhead incluido.
  const anchoReglas = Math.floor(cw * 0.62);
  const reglas = reglasLista(anchoReglas, [
    'El logotipo, el símbolo ">" y el playhead "i" se toman siempre del SVG oficial.',
    'No se redibujan ni se sustituyen por un signo escrito con una fuente.',
    'Color por defecto; negro o blanco se eligen según el fondo, nunca por gusto.',
    'No se recolorean fuera de la paleta de azules ni se les añaden sombras.',
    'El playhead "i" indica el paso activo; no se usa como viñeta de lista.',
    'Las formas del logo son recursos de interfaz, no un muestrario de figuras.',
    'Plus Jakarta Sans es la única familia del sistema; el logotipo es la excepción.',
  ]);

  // v24: las reglas ocupan la izquierda y a la derecha va un panel con los tres
  // elementos que nunca se redibujan. Antes quedaba un hueco en blanco a la
  // derecha de la lista.
  const anchoRef = cw - anchoReglas - 40;

  // v25: las dos piezas van EN FILA y con la misma caja, para que midan lo mismo
  // y quepan sin recortarse. Antes iban apiladas y el panel desbordaba.
  const anchoPiezaRef = Math.floor((anchoRef - 16) / 2);
  const panelElementos = container('panel / elementos de marca', {
    w: anchoRef, h: 26 + 12 + 158 + 12 + 40, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [
    label('LOS ELEMENTOS QUE NO SE REDIBUJAN', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    hairline('filete del panel', anchoRef, COLOR.textPrimary, 0.10),
    container('panel / piezas', {
      w: anchoRef, h: 158, dir: 'row', gap: 16, align: 'start', justify: 'start',
    }, [
      celdaPieza('chevron', COLOR.blue, COLOR.white, 56, anchoPiezaRef, 96),
      celdaPieza('playhead', COLOR.blue, COLOR.white, 56, anchoPiezaRef, 96),
    ]),
    text('Salen del SVG oficial del logotipo y se usan como recursos de interfaz.', {
      name: 'panel / nota', size: 11, font: font(WEIGHT.regular),
      color: COLOR.textSecondary, letterSpacing: '0.01', lineHeight: '1.3',
    }),
  ]);

  const altoReglas = Math.max(26 + 18 + (reglas.height || 274), 26 + 12 + 158 + 12 + 40);
  const bloqueReglas = container('bloque / reglas', {
    w: cw, h: altoReglas, dir: 'row', gap: 40, align: 'start', justify: 'start',
  }, [
    container('bloque / reglas texto', {
      w: anchoReglas, h: 26 + 18 + (reglas.height || 274), dir: 'column', gap: 0, align: 'start', justify: 'start',
    }, [
      label('REGLAS DE USO', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
      container('separacion / reglas', { w: anchoReglas, h: 18, dir: 'row', gap: 0, align: 'start', justify: 'start' }, []),
      reglas,
    ]),
    panelElementos,
  ]);

  // 4) Usos incorrectos: rojo solo como señal negativa, según la marca.
  const anchoProhibido = Math.floor((cw - 2 * 12) / 3);
  const incorrectosTexto = [
    'No se rota ni se inclina.',
    'No se deforma ni se estira.',
    'No se recolorea fuera de la paleta.',
    'No lleva sombras ni contornos.',
    'No se cambia la proporción entre símbolo y nombre.',
    'No va sobre fondos sin contraste.',
  ];

  const tarjetaProhibida = function (t, n) {
    const celda = container('prohibido / ' + pad2(n), {
      w: anchoProhibido, h: 96, dir: 'column', gap: 8, align: 'start', justify: 'start',
    }, [
      rect('marca de error / ' + pad2(n), anchoProhibido, 3, COLOR.red),
      label('USO INCORRECTO', { size: 9, color: COLOR.red, letterSpacing: TRACK.wider }),
      text(t, {
        name: 'prohibido texto / ' + pad2(n), size: 12, font: font(WEIGHT.regular),
        color: COLOR.textPrimary, letterSpacing: '0.01', lineHeight: '1.3',
      }),
    ]);
    try { celda.fills = [solid(COLOR.white)]; } catch (e) { /* opcional */ }
    return celda;
  };

  const filaProhibida1 = container('usos incorrectos / fila 1', {
    w: cw, h: 96, dir: 'row', gap: 12, align: 'start', justify: 'start',
  }, [tarjetaProhibida(incorrectosTexto[0], 1), tarjetaProhibida(incorrectosTexto[1], 2), tarjetaProhibida(incorrectosTexto[2], 3)]);

  const filaProhibida2 = container('usos incorrectos / fila 2', {
    w: cw, h: 96, dir: 'row', gap: 12, align: 'start', justify: 'start',
  }, [tarjetaProhibida(incorrectosTexto[3], 4), tarjetaProhibida(incorrectosTexto[4], 5), tarjetaProhibida(incorrectosTexto[5], 6)]);

  const incorrectos = container('usos incorrectos', {
    w: cw, h: 96 * 2 + 12, dir: 'column', gap: 12, align: 'start', justify: 'start',
  }, [filaProhibida1, filaProhibida2]);

  const bloqueIncorrectos = container('bloque / usos incorrectos', {
    w: cw, h: 26 + 14 + 96 * 2 + 12, dir: 'column', gap: 14, align: 'start', justify: 'start',
  }, [
    label('USOS INCORRECTOS', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    incorrectos,
  ]);
  // 5) Fondos permitidos, con la variante correcta en cada uno.
  const altoFondo = 96;
  const fondos = container('fondos permitidos / fila', {
    w: cw, h: altoFondo + 40, dir: 'row', gap: 24, align: 'start', justify: 'start',
  }, [
    logoPanel(logos.color, 'fondo blanco', COLOR.white, COLOR.blue,
      'Blanco o gris muy claro: variante color.', anchoPanel, altoFondo),
    logoPanel(logos.negro, 'fondo base', COLOR.bgBase, COLOR.textPrimary,
      'Fondo base y azules claros: variante negra.', anchoPanel, altoFondo),
    logoPanel(logos.blanco, 'fondo profundo', COLOR.blue900, COLOR.white,
      'Azul profundo o fotografía: variante blanca.', anchoPanel, altoFondo),
  ]);

  const bloqueFondos = container('bloque / fondos', {
    w: cw, h: 26 + 14 + altoFondo + 40, dir: 'column', gap: 14, align: 'start', justify: 'start',
  }, [
    label('FONDOS PERMITIDOS', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    fondos,
  ]);

  // 6) Formas del logo como recursos de interfaz, con dónde se usa cada una.
  const anchoRecurso = Math.floor((cw - 3 * 12) / 4);
  const recursos = container('recursos de interfaz / fila', {
    w: cw, h: 212, dir: 'row', gap: 12, align: 'start', justify: 'start',
  }, [
    celdaPieza('chevron', COLOR.blue, COLOR.white, 60, anchoRecurso, 120),
    celdaPieza('playhead', COLOR.blue, COLOR.white, 60, anchoRecurso, 120),
    celdaPieza('cinta', COLOR.blue, COLOR.white, 120, anchoRecurso, 120),
    celdaPieza('paralelogramo', COLOR.blue, COLOR.white, 120, anchoRecurso, 120),
  ]);

  const bloqueRecursos = container('bloque / recursos', {
    w: cw, h: 26 + 14 + 212, dir: 'column', gap: 14, align: 'start', justify: 'start',
  }, [
    label('FORMAS DEL LOGO COMO RECURSOS DE INTERFAZ', { size: 11, color: COLOR.blue, letterSpacing: TRACK.wider }),
    recursos,
  ]);

  const pie = footerBlock(cw, 'CRS DISEÑO  |  SISTEMA DE DISEÑO 1.12', 'PÁGINA 03');

  // ORDEN de los hijos del board.
  board.appendChild(cabecera);
  board.appendChild(encabezado);
  board.appendChild(variantes);
  board.appendChild(piezas);
  board.appendChild(bloqueRespeto);
  board.appendChild(bloqueReglas);
  board.appendChild(bloqueIncorrectos);
  board.appendChild(bloqueFondos);
  board.appendChild(bloqueRecursos);
  board.appendChild(pie);
}

// -----------------------------------------------------------------------------
// 6. SECCIONES DE LA PRESENTACIÓN (motor declarativo, fuente única).
//    Cada entrada: id, number, board, title, description, width, height,
//    enabled (se genera o no), listed (aparece en el índice) y builder.
//    Añadir una sección = añadir una entrada + su builder y activarla.
// -----------------------------------------------------------------------------

/** Builder de relleno para secciones todavía no implementadas. */
function deferredSection(id) {
  return function pendingBuilder() {
    try { console.warn('[CRS Penpot] Sección declarada pero pendiente de implementar:', id); } catch (e) { /* ignore */ }
  };
}

const SECTIONS = [
  {
    id: 'portada',
    number: '',
    board: '00 Portada',
    title: 'Portada',
    description: 'Apertura de marca: símbolo, nombre, propósito, pilares, rol y versión del documento.',
    width: BOARD_W,
    height: 840,
    enabled: true,
    listed: false,
    builder: buildPortada,
  },
  {
    id: 'indice',
    number: '',
    board: '01 Índice',
    title: 'Índice',
    description: 'Menú de la presentación, ruta de lectura y estado de cada sección.',
    width: BOARD_W,
    height: 900,
    enabled: true,
    listed: false,
    builder: buildIndice,
  },
  {
    id: 'proposito',
    number: '01',
    board: '02 Propósito y pilares',
    title: 'Propósito y pilares',
    description: 'El brief del sistema: la frase de propósito, lo que significa la marca y los pilares.',
    width: BOARD_W,
    height: 900,
    enabled: true,
    listed: true,
    state: 'GENERADA',
    builder: buildProposito,
  },
  {
    id: 'marca',
    number: '02',
    board: '03 Marca',
    title: 'Marca',
    description: 'Logotipo en tres variantes, simbolo y playhead aislados con area de respeto, reglas de uso, usos incorrectos, fondos y formas como recursos.',
    width: BOARD_W,
    height: 2440,
    enabled: true,
    listed: true,
    state: 'GENERADA',
    builder: buildMarca,
  },
  {
    id: 'fundaciones',
    number: '03',
    board: '04 Fundaciones',
    title: 'Fundaciones',
    description: 'Color, tipografía, retícula, espacio y sombras.',
    width: BOARD_W,
    height: 1200,
    enabled: false,
    listed: true,
    state: 'EN DISEÑO',
    builder: deferredSection('fundaciones'),
  },
  {
    id: 'componentes',
    number: '04',
    board: '05 Componentes',
    title: 'Componentes',
    description: 'Controles, navegación, feedback y datos.',
    width: BOARD_W,
    height: 1600,
    enabled: false,
    listed: true,
    state: 'PLANIFICADA',
    builder: deferredSection('componentes'),
  },
  {
    id: 'plantillas',
    number: '05',
    board: '06 Plantillas',
    title: 'Plantillas',
    description: 'Landing, página de caso y páginas internas.',
    width: BOARD_W,
    height: 1000,
    enabled: false,
    listed: true,
    state: 'PLANIFICADA',
    builder: deferredSection('plantillas'),
  },
  {
    id: 'key-visual',
    number: '06',
    board: '07 Key Visual',
    title: 'Key Visual',
    description: 'Composición de portada y piezas de campaña.',
    width: BOARD_W,
    height: 900,
    enabled: false,
    listed: true,
    state: 'PLANIFICADA',
    builder: deferredSection('key-visual'),
  },
  {
    id: 'aplicaciones-web',
    number: '07',
    board: '08 Aplicaciones web',
    title: 'Aplicaciones web',
    description: 'Interfaz del sitio, estados y adaptación móvil.',
    width: BOARD_W,
    height: 1100,
    enabled: false,
    listed: true,
    state: 'PLANIFICADA',
    builder: deferredSection('aplicaciones-web'),
  },
];

// Única llave para activar páginas. La v8 genera portada e índice; las
// próximas versiones añaden aquí su id (y `enabled: true` en la entrada).
const ACTIVE_IDS = ['portada', 'indice', 'proposito', 'marca'];

/** Secciones que se generan ahora. */
function activeSections() {
  return SECTIONS.filter(function (s) {
    return s.enabled !== false && ACTIVE_IDS.indexOf(s.id) !== -1;
  });
}

/** Secciones que lista el índice (nunca la portada ni el propio índice). */
function listedSections() {
  return SECTIONS.filter(function (s) { return s.listed === true; });
}

/**
 * Crea el board de una sección con el PATRÓN DE LA v5:
 * createBoard() + resize(1280, alto) + fills + addFlexLayout() con dir
 * 'column', padding y gap. El contenido entra después con appendChild.
 */
function createSectionBoard(section, index) {
  const w = section.width || BOARD_W;
  const h = section.height || BOARD_H;

  const b = P.createBoard();
  b.name = safeName(section.board || section.title, 'Pagina');
  try { b.resize(w, h); } catch (e) { /* tamaño por defecto */ }
  try { b.fills = [solid(COLOR.white)]; } catch (e) { /* fill opcional */ }
  // Posición del board en el LIENZO (no es posicionamiento de hijos).
  try { b.x = (index || 0) * (w + GUTTER); b.y = 0; } catch (e) { /* best effort */ }

  try {
    const flex = b.addFlexLayout();
    flex.dir = 'column';
    flex.alignItems = 'start';
    flex.justifyContent = 'space-between';
    flex.rowGap = 24;
    flex.columnGap = 24;
    flex.topPadding = PAD;
    flex.rightPadding = PAD;
    flex.bottomPadding = PAD;
    flex.leftPadding = PAD;
  } catch (e) { /* sin flex */ }

  return b;
}

// -----------------------------------------------------------------------------
// 7. DIAGNÓSTICO (dejado puesto a propósito: la v6 falló en silencio).
// -----------------------------------------------------------------------------

/** Hijos directos de una forma. */
function countChildren(shape) {
  try { return (shape && shape.children) ? shape.children.length : 0; } catch (e) { return 0; }
}

/** Objetos totales del árbol de una forma (hijos, nietos...). */
function countTree(shape) {
  let n = 0;
  try {
    const kids = (shape && shape.children) ? shape.children : [];
    for (let i = 0; i < kids.length; i++) {
      n += 1 + countTree(kids[i]);
    }
  } catch (e) { /* conteo best effort */ }
  return n;
}

// -----------------------------------------------------------------------------
// 8. BIBLIOTECA COMPARTIDA (colores y tipografías del sistema).
//    Sin Bank Gothic: las 8 tipografías son Plus Jakarta Sans.
//    v10: las listas ya NO se repiten aquí. Salen de TOKEN_COLORS y
//    TOKEN_TYPOS, que son la misma fuente que genera tokens.json. Una sola
//    lista en el archivo: la biblioteca de Penpot y el archivo publicado no
//    pueden desincronizarse.
// -----------------------------------------------------------------------------

// Vista [nombre, valor] de los tokens, para la biblioteca de Penpot.
const COLOR_LIBRARY = TOKEN_COLORS.map(function (c) { return [c[0], c[1]]; });

// Vista [nombre, peso, tamaño] de la escala tipográfica.
const TYPOGRAPHY_LIBRARY = TOKEN_TYPOS.map(function (t) { return [t[0], t[1], t[2]]; });

/** Crea los 19 colores compartidos de marca. */
async function createColorLibrary() {
  const lib = P && P.library ? (P.library.local || P.library) : null;
  if (!lib || typeof lib.createColor !== 'function') return false;
  for (const pair of COLOR_LIBRARY) {
    try {
      const c = lib.createColor();
      c.name = safeName(pair[0], 'Color');
      c.color = pair[1];
      c.opacity = 1;
    } catch (e) {
      try { console.warn('[CRS Penpot] No se pudo crear el color', pair[0], e); } catch (e2) { /* ignore */ }
    }
  }
  return true;
}

/** Crea las 8 tipografías compartidas, todas en Plus Jakarta Sans. */
async function createTypographyLibrary() {
  const lib = P && P.library ? (P.library.local || P.library) : null;
  if (!lib || typeof lib.createTypography !== 'function') return false;
  for (const entry of TYPOGRAPHY_LIBRARY) {
    try {
      const ty = lib.createTypography();
      ty.name = safeName(entry[0], 'Tipografia');
      ty.fontFamily = FONT;
      ty.fontStyle = 'normal';
      ty.fontWeight = String(entry[1]);
      ty.fontSize = String(entry[2]);
    } catch (e) {
      try { console.warn('[CRS Penpot] No se pudo crear la tipografía', entry[0], e); } catch (e2) { /* ignore */ }
    }
  }
  return true;
}

// -----------------------------------------------------------------------------
// 9. ORQUESTADOR: recorre solo las secciones activas, una por una, con
//    diagnóstico por sección (conteo de objetos y error literal).
// -----------------------------------------------------------------------------

async function generate() {
  const started = Date.now();

  // 0) Logotipos: el arrastrado por el usuario manda; si no hay, se descargan
  //    los oficiales que viajan con el plugin. Nunca bloquea la generación.
  try { LOGOS = await loadLogos(); } catch (e) { LOGOS = {}; }
  try { console.log('[CRS] logo=' + ((LOGOS && LOGOS.origen) || 'sin archivo')); } catch (e) { /* opcional */ }

  // 1) Biblioteca compartida (colores + tipografías). Mejor esfuerzo.
  const colorsOk = await createColorLibrary();
  const typosOk = await createTypographyLibrary();

  // 2) Boards de las secciones activas, en fila y con separación.
  const active = activeSections();
  const built = [];
  let total = 0;
  let cursorIndex = 0;

  active.forEach(function (section) {
    const board = createSectionBoard(section, cursorIndex);
    cursorIndex += 1;

    // Cada sección se dibuja aislada: un fallo no tumba el resto.
    let sectionError = null;
    try {
      if (typeof section.builder === 'function') section.builder(board, section);
    } catch (e) {
      sectionError = e;
    }

    const directos = countChildren(board);
    const objetos = countTree(board);
    total += objetos;

    // DIAGNÓSTICO obligatorio: "[CRS] <id> hijos=N".
    try {
      console.log('[CRS] ' + section.id + ' hijos=' + directos + ' total=' + objetos +
        (sectionError ? ' ERROR=' + (sectionError.message || sectionError) : ''));
    } catch (e) { /* consola opcional */ }

    // Medidas y jerarquía: lo que la v7 necesitaba para diagnosticar.
    try {
      console.log('[CRS] ' + section.id + ' board=' + board.width + 'x' + board.height +
        ' flex=' + (board.flex ? 'si' : 'no') +
        ' primero=' + (directos ? board.children[0].name : '(vacio)') +
        ' ultimo=' + (directos ? board.children[directos - 1].name : '(vacio)'));
    } catch (e) { /* consola opcional */ }

    if (sectionError) {
      const detail = (sectionError && sectionError.message) ? sectionError.message : String(sectionError);
      try { P.notify('Sección ' + section.id + ': error ' + detail, 'error'); } catch (e) { /* ignore */ }
    } else {
      try { P.notify('Sección ' + section.id + ': ' + objetos + ' objetos', 'success'); } catch (e) { /* ignore */ }
    }

    built.push((section.board || section.title) + ' (' + objetos + ' objetos)');
  });

  // 3) Cierre: total y tiempo.
  const ms = Date.now() - started;
  const tiempo = (ms / 1000).toFixed(1) + 's';
  const summary =
    'CRS Design System v1.12: ' + built.length + ' páginas (' + built.join(', ') + ')' +
    ', ' + total + ' objetos' +
    (colorsOk ? ', ' + COLOR_LIBRARY.length + ' colores' : '') +
    (typosOk ? ', ' + TYPOGRAPHY_LIBRARY.length + ' tipografías' : '') +
    ' en ' + tiempo + '. Tipografía del sistema: Plus Jakarta Sans.';

  try { console.log('[CRS] total=' + total + ' tiempo=' + tiempo); } catch (e) { /* consola opcional */ }
  try { P.notify(summary, 'success'); } catch (e) { /* notify opcional */ }
  return summary;
}

// -----------------------------------------------------------------------------
// 10. UI DEL PLUGIN
// -----------------------------------------------------------------------------

/** Abre el modal con index.html (Penpot carga el index.html del plugin). */
function openUi() {
  if (!pluginUi || typeof pluginUi.open !== 'function') return false;
  try {
    pluginUi.open('CRS Design System Generator', '');
    return true;
  } catch (e) {
    try { console.warn('[CRS Penpot] No se pudo abrir la UI', e); } catch (e2) { /* ignore */ }
    return false;
  }
}

/** Envía un mensaje de vuelta a la UI (best effort). */
function sendToUi(message) {
  if (!pluginUi) return;
  try {
    if (typeof pluginUi.sendMessage === 'function') pluginUi.sendMessage(message);
    else if (typeof pluginUi.send === 'function') pluginUi.send(message);
  } catch (e) { /* best effort */ }
}

/** Registra el listener de mensajes de la UI una sola vez. */
let uiMessageAttached = false;
function onUiMessage(handler) {
  if (uiMessageAttached) return true;
  if (pluginUi) {
    if (typeof pluginUi.onMessage === 'function') {
      try { pluginUi.onMessage(handler); uiMessageAttached = true; return true; } catch (e) { /* sigue */ }
    }
    if (typeof pluginUi.on === 'function') {
      try { pluginUi.on('message', handler); uiMessageAttached = true; return true; } catch (e) { /* sigue */ }
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// 11. ARRANQUE
// -----------------------------------------------------------------------------
(function main() {
  if (!P) {
    try { console.warn('[CRS Penpot] API de Penpot no disponible'); } catch (e) { /* ignore */ }
    return;
  }

  // 1) Abrir la ventana PRIMERO: si algo posterior falla, la UI ya está visible.
  let opened = false;
  try { opened = openUi(); } catch (e) { opened = false; }
  if (!opened) {
    try { P.notify('No se pudo abrir la ventana del plugin. Revisa la consola del navegador (F12).', 'warning'); } catch (e) { /* ignore */ }
  }

  // 2) Escuchar a la ventana del plugin (una sola vez).
  //    - 'crs-generate': genera las secciones activas.
  //    - 'crs-logo': el usuario arrastró un SVG; se guarda para la sección de
  //      marca. El UI lo lee con FileReader porque el plugin no puede ver el
  //      disco del usuario.
  onUiMessage(async (msg) => {
    const data = (msg && msg.pluginMessage) ? msg.pluginMessage : msg;
    const type = (typeof data === 'string') ? data : (data && data.type);

    if (type === 'crs-logo') {
      const svg = (data && data.svg) ? String(data.svg) : '';
      const nombre = (data && data.name) ? String(data.name) : 'logotipo';
      if (svg.indexOf('<svg') === -1) {
        try { P.notify('El archivo no parece un SVG: ' + nombre, 'error'); } catch (e) { /* ignore */ }
        sendToUi({ type: 'crs-logo-status', ok: false, name: nombre });
        return;
      }
      LOGO_RECIBIDO = { name: nombre, svg: svg };
      try { P.notify('Logotipo recibido: ' + nombre, 'success'); } catch (e) { /* ignore */ }
      sendToUi({ type: 'crs-logo-status', ok: true, name: nombre });
      return;
    }

    if (type !== 'crs-generate') return;

    // v23: el brief que llega del formulario manda sobre los valores por defecto.
    if (data && data.brief) {
      aplicarBrief(data.brief);
      try { console.log('[CRS] brief: pilares=' + BRIEF.pilares.length + ' distintivos=' + BRIEF.distintivos.length + ' principal=' + (BRIEF.distintivos.filter(function (d) { return d[1]; })[0] || ['ninguno'])[0]); } catch (e) { /* opcional */ }
    }
    try {
      const summary = await generate();
      sendToUi({ type: 'crs-done', summary: summary });
    } catch (err) {
      const detail = (err && err.message) ? err.message : String(err);
      try { console.error('[CRS Penpot] Error:', err); } catch (e) { /* ignore */ }
      try { P.notify('Error al generar: ' + detail, 'error'); } catch (e) { /* ignore */ }
      sendToUi({ type: 'crs-error', error: detail });
    }
  });
})();

// -----------------------------------------------------------------------------
// 12. SALIDA PARA NODE (v10). Permite generar tokens.json desde la línea de
//     comandos con el mismo código que usa Penpot, así que el archivo publicado
//     no puede desincronizarse de lo que el plugin dibuja.
//     En el runtime de Penpot este bloque no se ejecuta: no existe `module`.
// -----------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildTokens: buildTokens,
    SPACING: SPACING,
    TOKEN_COLORS: TOKEN_COLORS,
    TOKEN_TYPOS: TOKEN_TYPOS,
    FONT: FONT,
    FONT_STACK: FONT_STACK,
  };
}
