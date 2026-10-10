'use strict';

/* ---------- Estado y almacenamiento (localStorage) ---------- */
const KEY = 'gre-transportista-v1';
const vacio = () => ({ guias: [], vehiculos: [], conductores: [], entidades: [], config: { transportistaRuc: '', transportistaNombre: '', serie: 'V001' } });
let db = vacio();

function cargar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = Object.assign(vacio(), JSON.parse(raw));
  } catch (e) { /* almacenamiento no disponible: se trabaja en memoria */ }
}
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('No se pudo guardar en este navegador'); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Utilidades ---------- */
function h(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}
function copiar(texto) {
  const ok = () => toast('Copiado');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, () => toast('No se pudo copiar'));
  else {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = texto; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { toast('No se pudo copiar'); }
    ta.remove();
  }
}

/* ---------- Validaciones ---------- */
function rucValido(r) {
  if (!/^\d{11}$/.test(r) || !/^(10|15|16|17|20)/.test(r)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = w.reduce((a, x, i) => a + x * Number(r[i]), 0);
  return (11 - (s % 11)) % 10 === Number(r[10]);
}
const dniValido = d => /^\d{8}$/.test(d);
const placaValida = p => /^[A-Z0-9]{6,7}$/.test(p.replace(/-/g, ''));
const numGuiaValido = g => /^[A-Z0-9]{4}-\d{1,8}$/.test(g);
const normPlaca = p => p.toUpperCase().replace(/[\s-]/g, '');

function validarDoc(tipo, num) {
  if (tipo === 'RUC') return rucValido(num) ? '' : 'RUC inválido (11 dígitos con dígito verificador)';
  if (tipo === 'DNI') return dniValido(num) ? '' : 'DNI inválido (8 dígitos)';
  return num.length >= 4 ? '' : 'Documento muy corto';
}

/* ---------- Vistas ---------- */
const app = document.getElementById('app');
let vista = 'guias';
let editando = null; // id de guía en edición, 'nueva' o null
let hojaId = null;

document.getElementById('tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  vista = b.dataset.view; editando = null; hojaId = null; render();
});

function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === vista));
  app.replaceChildren();
  if (vista === 'guias') hojaId ? vistaHoja() : editando ? vistaFormGuia() : vistaListaGuias();
  else if (vista === 'catalogos') vistaCatalogos();
  else if (vista === 'sunat') vistaSunat();
  else vistaRespaldo();
}

/* ----- Lista de guías ----- */
let filtro = '';
function vistaListaGuias() {
  const q = filtro.toLowerCase();
  const items = db.guias.filter(g => !q || JSON.stringify(g).toLowerCase().includes(q))
    .sort((a, b) => (b.fechaTraslado || '').localeCompare(a.fechaTraslado || ''));
  app.append(
    h('h2', {}, 'Guías de remisión'),
    h('div', { class: 'toolbar' },
      h('input', { type: 'search', placeholder: 'Buscar por número, cliente, placa…', value: filtro, oninput: e => { filtro = e.target.value; render(); const i = app.querySelector('input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }),
      h('button', { class: 'btn primary', onclick: () => { editando = 'nueva'; render(); } }, '+ Nueva')),
    items.length ? h('div', { class: 'card' }, items.map(g => h('div', { class: 'list-item' },
      h('div', {},
        h('strong', {}, g.guiaRemitente || '(sin número)'), ' ',
        h('span', { class: 'badge ' + g.estado }, etiquetaEstado(g.estado)),
        h('div', { class: 'meta' }, [g.fechaTraslado, g.destNombre, g.placa].filter(Boolean).join(' · ')),
        g.greT ? h('div', { class: 'meta' }, 'GRE-T: ' + g.greT) : null),
      h('div', { class: 'row', style: 'flex:0 0 auto;flex-wrap:nowrap' },
        h('button', { class: 'btn small', onclick: () => { hojaId = g.id; render(); } }, 'Hoja'),
        h('button', { class: 'btn small', onclick: () => { editando = g.id; render(); } }, 'Editar'))
    ))) : h('div', { class: 'card meta' }, db.guias.length ? 'Sin resultados.' : 'Aún no hay guías. Pulse “+ Nueva” para registrar la primera.')
  );
}
const etiquetaEstado = e => ({ borrador: 'Borrador', listo: 'Lista para SUNAT', emitida: 'Emitida' }[e] || 'Borrador');

/* ----- Formulario de guía ----- */
function campo(label, name, valor, opts = {}) {
  const tag = opts.options ? 'select' : opts.area ? 'textarea' : 'input';
  const el = h(tag, { name, type: opts.type || (tag === 'input' ? 'text' : null), value: tag === 'select' ? null : valor || '', placeholder: opts.ph, list: opts.list, inputmode: opts.inputmode, rows: opts.area ? 2 : null, step: opts.step, min: opts.min },
    ...(opts.options || []).map(o => h('option', { value: o[0], selected: o[0] === valor }, o[1])));
  if (tag === 'textarea') el.value = valor || '';
  return h('div', {}, h('label', {}, label), el, h('div', { class: 'err', 'data-err': name }));
}

function vistaFormGuia() {
  const g = editando === 'nueva'
    ? { id: uid(), estado: 'borrador', fechaTraslado: new Date().toISOString().slice(0, 10), unidad: 'KGM', modalidad: '01', remDocTipo: 'RUC', destDocTipo: 'RUC' }
    : Object.assign({}, db.guias.find(x => x.id === editando));
  const tdoc = [['RUC', 'RUC'], ['DNI', 'DNI'], ['CE', 'Carné extranjería']];

  const form = h('form', { novalidate: true },
    h('h2', {}, editando === 'nueva' ? 'Nueva guía' : 'Editar guía'),
    h('div', { class: 'card' },
      h('h3', {}, 'Guía del remitente (documento relacionado)'),
      h('div', { class: 'row' },
        campo('N.º de guía de remisión remitente', 'guiaRemitente', g.guiaRemitente, { ph: 'T001-00022562' }),
        campo('Fecha de inicio del traslado', 'fechaTraslado', g.fechaTraslado, { type: 'date' }))),
    h('div', { class: 'card' },
      h('h3', {}, 'Remitente'),
      h('div', { class: 'row' }, campo('Tipo doc.', 'remDocTipo', g.remDocTipo, { options: tdoc }), campo('Número', 'remDoc', g.remDoc, { inputmode: 'numeric', list: 'dl-ent' }), campo('Razón social / nombre', 'remNombre', g.remNombre)),
      h('h3', {}, 'Destinatario'),
      h('div', { class: 'row' }, campo('Tipo doc.', 'destDocTipo', g.destDocTipo, { options: tdoc }), campo('Número', 'destDoc', g.destDoc, { inputmode: 'numeric', list: 'dl-ent' }), campo('Razón social / nombre', 'destNombre', g.destNombre))),
    h('div', { class: 'card' },
      h('h3', {}, 'Puntos de partida y llegada'),
      h('div', { class: 'row' }, campo('Ubigeo de partida (6 dígitos)', 'partidaUbigeo', g.partidaUbigeo, { inputmode: 'numeric' }), campo('Dirección de partida', 'partidaDir', g.partidaDir)),
      h('div', { class: 'row' }, campo('Ubigeo de llegada (6 dígitos)', 'llegadaUbigeo', g.llegadaUbigeo, { inputmode: 'numeric' }), campo('Dirección de llegada', 'llegadaDir', g.llegadaDir))),
    h('div', { class: 'card' },
      h('h3', {}, 'Bienes a transportar'),
      campo('Descripción', 'descripcion', g.descripcion, { area: true }),
      h('div', { class: 'row' },
        campo('Cantidad', 'cantidad', g.cantidad, { type: 'number', step: 'any', min: '0' }),
        campo('Unidad de medida', 'unidad', g.unidad, { options: [['KGM', 'Kilogramo (KGM)'], ['TNE', 'Tonelada (TNE)'], ['NIU', 'Unidad (NIU)'], ['BX', 'Caja (BX)'], ['ZZ', 'Servicio (ZZ)']] }),
        campo('Peso bruto total (kg)', 'peso', g.peso, { type: 'number', step: 'any', min: '0' }))),
    h('div', { class: 'card' },
      h('h3', {}, 'Vehículo y conductor'),
      h('div', { class: 'row' },
        campo('Placa', 'placa', g.placa, { list: 'dl-veh', ph: 'ABC123' }),
        campo('Conductor (DNI)', 'conductorDni', g.conductorDni, { list: 'dl-con', inputmode: 'numeric' })),
      h('div', { class: 'row' },
        campo('Nombres del conductor', 'conductorNombre', g.conductorNombre),
        campo('Licencia de conducir', 'licencia', g.licencia))),
    h('div', { class: 'card' },
      h('h3', {}, 'Estado'),
      h('div', { class: 'row' },
        campo('Estado de la guía', 'estado', g.estado, { options: [['borrador', 'Borrador'], ['listo', 'Lista para SUNAT'], ['emitida', 'Emitida en SUNAT']] }),
        campo('N.º GRE-T emitida (cuando SUNAT la genere)', 'greT', g.greT, { ph: 'V001-00000001' }))),
    h('datalist', { id: 'dl-ent' }, db.entidades.map(e => h('option', { value: e.doc }, e.nombre))),
    h('datalist', { id: 'dl-veh' }, db.vehiculos.map(v => h('option', { value: v.placa }, v.notas || ''))),
    h('datalist', { id: 'dl-con' }, db.conductores.map(c => h('option', { value: c.dni }, c.nombre))),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'submit' }, 'Guardar'),
      h('button', { class: 'btn', type: 'button', onclick: () => { editando = null; render(); } }, 'Cancelar'),
      editando !== 'nueva' ? h('button', { class: 'btn danger', type: 'button', onclick: () => { if (confirm('¿Eliminar esta guía?')) { db.guias = db.guias.filter(x => x.id !== g.id); guardar(); editando = null; render(); } } }, 'Eliminar') : null));

  // Autocompletar desde catálogos
  const val = n => form.elements[n].value.trim();
  const set = (n, v) => { form.elements[n].value = v; };
  form.elements.remDoc.addEventListener('change', () => { const e = db.entidades.find(x => x.doc === val('remDoc')); if (e) { set('remNombre', e.nombre); set('remDocTipo', e.tipo); } });
  form.elements.destDoc.addEventListener('change', () => { const e = db.entidades.find(x => x.doc === val('destDoc')); if (e) { set('destNombre', e.nombre); set('destDocTipo', e.tipo); } });
  form.elements.conductorDni.addEventListener('change', () => { const c = db.conductores.find(x => x.dni === val('conductorDni')); if (c) { set('conductorNombre', c.nombre); set('licencia', c.licencia || ''); } });

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const d = Object.assign({}, g);
    for (const el of form.elements) if (el.name) d[el.name] = el.value.trim();
    d.placa = normPlaca(d.placa || '');
    const errs = {};
    if (!numGuiaValido(d.guiaRemitente || '')) errs.guiaRemitente = 'Formato esperado: T001-00022562';
    if (!d.fechaTraslado) errs.fechaTraslado = 'Requerida';
    const eR = validarDoc(d.remDocTipo, d.remDoc || ''); if (eR) errs.remDoc = eR;
    const eD = validarDoc(d.destDocTipo, d.destDoc || ''); if (eD) errs.destDoc = eD;
    if (!d.remNombre) errs.remNombre = 'Requerido';
    if (!d.destNombre) errs.destNombre = 'Requerido';
    for (const k of ['partidaUbigeo', 'llegadaUbigeo']) if (!/^\d{6}$/.test(d[k] || '')) errs[k] = '6 dígitos';
    if (!d.partidaDir) errs.partidaDir = 'Requerida';
    if (!d.llegadaDir) errs.llegadaDir = 'Requerida';
    if (!d.descripcion) errs.descripcion = 'Requerida';
    if (!(Number(d.cantidad) > 0)) errs.cantidad = 'Mayor que 0';
    if (!(Number(d.peso) > 0)) errs.peso = 'Mayor que 0';
    if (!placaValida(d.placa)) errs.placa = 'Placa inválida';
    if (!dniValido(d.conductorDni || '')) errs.conductorDni = 'DNI inválido';
    if (!d.conductorNombre) errs.conductorNombre = 'Requerido';
    if (!d.licencia) errs.licencia = 'Requerida';
    if (d.greT && !numGuiaValido(d.greT)) errs.greT = 'Formato esperado: V001-00000001';
    if (d.estado === 'emitida' && !d.greT) errs.greT = 'Indique el número emitido';
    form.querySelectorAll('[data-err]').forEach(x => { x.textContent = errs[x.dataset.err] || ''; });
    // Un borrador puede guardarse incompleto; las demás etapas exigen todo válido
    if (Object.keys(errs).length && d.estado !== 'borrador') { toast('Corrija los campos marcados'); return; }
    if (Object.keys(errs).length) toast('Guardado como borrador con campos pendientes');
    const i = db.guias.findIndex(x => x.id === d.id);
    if (i >= 0) db.guias[i] = d; else db.guias.push(d);
    guardar(); editando = null; render();
  });
  app.append(form);
}

/* ----- Hoja para copiar a SUNAT ----- */
function vistaHoja() {
  const g = db.guias.find(x => x.id === hojaId);
  const tdoc = t => ({ RUC: 'RUC', DNI: 'DNI', CE: 'Carné de extranjería' }[t] || t);
  const secciones = [
    ['Datos generales', [
      ['Fecha de emisión', new Date().toISOString().slice(0, 10)],
      ['Fecha de inicio del traslado', g.fechaTraslado],
      ['Tipo de documento relacionado', 'Guía de remisión remitente'],
      ['N.º documento relacionado', g.guiaRemitente]]],
    ['Remitente', [['Tipo de documento', tdoc(g.remDocTipo)], ['Número', g.remDoc], ['Razón social', g.remNombre]]],
    ['Destinatario', [['Tipo de documento', tdoc(g.destDocTipo)], ['Número', g.destDoc], ['Razón social', g.destNombre]]],
    ['Punto de partida', [['Ubigeo', g.partidaUbigeo], ['Dirección', g.partidaDir]]],
    ['Punto de llegada', [['Ubigeo', g.llegadaUbigeo], ['Dirección', g.llegadaDir]]],
    ['Bien transportado', [['Descripción', g.descripcion], ['Cantidad', g.cantidad], ['Unidad de medida', g.unidad], ['Peso bruto total (kg)', g.peso]]],
    ['Vehículo', [['Placa', g.placa]]],
    ['Conductor', [['Tipo de documento', 'DNI'], ['Número', g.conductorDni], ['Nombres y apellidos', g.conductorNombre], ['Licencia de conducir', g.licencia]]]
  ];
  const faltan = secciones.flatMap(s => s[1]).filter(f => f[1] == null || f[1] === '').length;
  app.append(
    h('h2', {}, 'Hoja para SUNAT · ' + g.guiaRemitente),
    faltan ? h('div', { class: 'note' }, `Faltan ${faltan} dato(s). Edite la guía antes de emitir.`) : null,
    h('p', { class: 'meta no-print' }, 'Use “Copiar” en cada campo y péguelo en el formulario de Guía de Remisión Electrónica Transportista de SUNAT.'),
    ...secciones.map(([t, fs]) => h('div', { class: 'card' }, h('h3', {}, t), fs.map(([k, v]) =>
      h('div', { class: 'sheet-field' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v || '—'),
        v ? h('button', { class: 'btn small', onclick: () => copiar(String(v)) }, 'Copiar') : null)))),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: () => window.print() }, 'Imprimir / PDF'),
      h('button', { class: 'btn', onclick: () => { editando = g.id; hojaId = null; render(); } }, 'Editar'),
      h('button', { class: 'btn', onclick: () => { hojaId = null; render(); } }, 'Volver'))
  );
}

/* ----- Catálogos ----- */
function bloqueCatalogo(titulo, lista, campos, vacioMsg, onAdd, onDel, resumen) {
  const form = h('form', { class: 'row', novalidate: true },
    ...campos.map(c => h('div', {}, h('label', {}, c.label), c.options ? h('select', { name: c.name }, c.options.map(o => h('option', { value: o }, o))) : h('input', { name: c.name, placeholder: c.ph || '', inputmode: c.inputmode }))),
    h('div', { style: 'align-self:end;flex:0 0 auto' }, h('button', { class: 'btn primary', type: 'submit' }, 'Agregar')),
    h('div', { class: 'err', 'data-err': 'x', style: 'flex-basis:100%' }));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = {}; for (const el of form.elements) if (el.name) d[el.name] = el.value.trim();
    const err = onAdd(d);
    if (err) form.querySelector('[data-err]').textContent = err; else { guardar(); render(); }
  });
  return h('div', { class: 'card' }, h('h2', {}, titulo), form,
    lista.length ? lista.map((x, i) => h('div', { class: 'list-item' }, h('div', {}, ...resumen(x)), h('button', { class: 'btn small danger', onclick: () => { onDel(i); guardar(); render(); } }, 'Quitar'))) : h('p', { class: 'meta' }, vacioMsg));
}
function vistaCatalogos() {
  app.append(
    bloqueCatalogo('Clientes (remitentes / destinatarios)', db.entidades,
      [{ label: 'Tipo', name: 'tipo', options: ['RUC', 'DNI', 'CE'] }, { label: 'Documento', name: 'doc', inputmode: 'numeric' }, { label: 'Nombre / razón social', name: 'nombre' }],
      'Sin clientes registrados.',
      d => { const e = validarDoc(d.tipo, d.doc); if (e) return e; if (!d.nombre) return 'Falta el nombre'; if (db.entidades.some(x => x.doc === d.doc)) return 'Ya existe ese documento'; db.entidades.push(d); },
      i => db.entidades.splice(i, 1), x => [h('strong', {}, x.nombre), h('div', { class: 'meta' }, x.tipo + ' ' + x.doc)]),
    bloqueCatalogo('Vehículos', db.vehiculos,
      [{ label: 'Placa', name: 'placa', ph: 'ABC123' }, { label: 'Notas (tipo, TUC…)', name: 'notas' }],
      'Sin vehículos registrados.',
      d => { d.placa = normPlaca(d.placa); if (!placaValida(d.placa)) return 'Placa inválida'; if (db.vehiculos.some(x => x.placa === d.placa)) return 'Ya existe esa placa'; db.vehiculos.push(d); },
      i => db.vehiculos.splice(i, 1), x => [h('strong', {}, x.placa), h('div', { class: 'meta' }, x.notas || '')]),
    bloqueCatalogo('Conductores', db.conductores,
      [{ label: 'DNI', name: 'dni', inputmode: 'numeric' }, { label: 'Nombres y apellidos', name: 'nombre' }, { label: 'Licencia', name: 'licencia' }],
      'Sin conductores registrados.',
      d => { if (!dniValido(d.dni)) return 'DNI inválido'; if (!d.nombre) return 'Falta el nombre'; if (db.conductores.some(x => x.dni === d.dni)) return 'Ya existe ese DNI'; db.conductores.push(d); },
      i => db.conductores.splice(i, 1), x => [h('strong', {}, x.nombre), h('div', { class: 'meta' }, 'DNI ' + x.dni + (x.licencia ? ' · Lic. ' + x.licencia : ''))])
  );
}

/* ----- SUNAT: datos del transportista y estado de la emisión ----- */
function vistaSunat() {
  const c = db.config;
  const form = h('form', { novalidate: true },
    h('h2', {}, 'Datos del transportista'),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, campo('RUC del transportista', 'transportistaRuc', c.transportistaRuc, { inputmode: 'numeric' }), campo('Razón social', 'transportistaNombre', c.transportistaNombre), campo('Serie GRE-T', 'serie', c.serie)),
      h('div', { class: 'err', 'data-err': 'x' }),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'submit' }, 'Guardar'))));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries([...form.elements].filter(x => x.name).map(x => [x.name, x.value.trim()]));
    if (d.transportistaRuc && !rucValido(d.transportistaRuc)) { form.querySelector('[data-err="x"]').textContent = 'RUC inválido'; return; }
    db.config = d; guardar(); toast('Guardado');
  });
  app.append(form,
    h('h2', {}, 'Emisión automática en SUNAT'),
    h('div', { class: 'card' },
      h('p', {}, h('strong', {}, 'Estado: pendiente de configurar.')),
      h('p', {}, 'Por ahora la app prepara los datos y usted emite la guía en SUNAT copiando desde la hoja. Para emitir desde la app hace falta un servidor propio (esta página no puede guardar secretos de forma segura) y estas credenciales oficiales:'),
      h('ul', {}, h('li', {}, 'Credenciales API (client_id y client_secret) generadas en el menú SOL de SUNAT, sección de “Credenciales de API”.'), h('li', {}, 'Usuario secundario SOL con permiso para GRE.'), h('li', {}, 'Certificado digital, según el flujo elegido.')),
      h('p', { class: 'note' }, 'No escriba la clave SOL ni las claves API en esta página: se guardarían en el navegador sin protección.')));
}

/* ----- Respaldo ----- */
function vistaRespaldo() {
  const file = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
  file.addEventListener('change', () => {
    const f = file.files[0]; if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      if (!d || !Array.isArray(d.guias)) throw new Error('formato');
      if (!confirm('Esto reemplaza todos los datos actuales. ¿Continuar?')) return;
      db = Object.assign(vacio(), d); guardar(); toast('Respaldo restaurado'); render();
    }).catch(() => toast('Archivo no válido'));
  });
  app.append(h('h2', {}, 'Respaldo de datos'),
    h('div', { class: 'card' },
      h('p', {}, 'Los datos se guardan solo en este navegador. Descargue un respaldo con frecuencia, sobre todo antes de limpiar el historial o cambiar de equipo.'),
      h('p', { class: 'meta' }, `${db.guias.length} guías · ${db.entidades.length} clientes · ${db.vehiculos.length} vehículos · ${db.conductores.length} conductores`),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })), download: 'respaldo-guias-' + new Date().toISOString().slice(0, 10) + '.json' });
          document.body.append(a); a.click(); a.remove();
        } }, 'Descargar respaldo'),
        h('button', { class: 'btn', onclick: () => file.click() }, 'Restaurar respaldo'), file)));
}

cargar();
render();
