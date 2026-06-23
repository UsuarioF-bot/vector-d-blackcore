const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { generatePdfBuffer, generateExcelBuffer, generateInvoicePdfBuffer, buildClientAnalytics } = require('./lib/reports');
const { cancelExpiredPending } = require('./lib/appointments');
const { localDateStr, eachDayInRange } = require('./lib/dates');

const app = express();
const PORT = Number(process.env.VET_MIS_PORT) || 3001;
const clientDist =
  process.env.VET_MIS_CLIENT_DIST || path.join(__dirname, '..', 'client', 'dist');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// ─────────────────────────────────────────
//  AUTENTICACIÓN
// ─────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, nombre, rol FROM usuarios WHERE username = ? AND password = ?').get(username, password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
});

// ─────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    ingresos_mes: db.prepare("SELECT COALESCE(SUM(total),0) as t FROM facturas WHERE estado='Pagada' AND fecha>=date('now','start of month')").get().t,
    citas_hoy: db.prepare("SELECT COUNT(*) as c FROM citas WHERE fecha=date('now')").get().c,
    nuevos_pacientes: db.prepare("SELECT COUNT(*) as c FROM pacientes").get().c,
    stock_bajo: db.prepare("SELECT COUNT(*) as c FROM inventario WHERE stock<=minimo").get().c,
  });
});

app.get('/api/dashboard/chart', (req, res) => {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(localDateStr(d));
  }
  const start = days[0];
  const end = days[days.length - 1];
  const rows = db
    .prepare(
      `
    SELECT fecha, SUM(total) as total
    FROM facturas
    WHERE estado = 'Pagada' AND fecha BETWEEN ? AND ?
    GROUP BY fecha
  `
    )
    .all(start, end);
  const byDate = Object.fromEntries(rows.map((r) => [r.fecha, Number(r.total)]));
  res.json(days.map((fecha) => ({ fecha, total: byDate[fecha] || 0 })));
});

// ─────────────────────────────────────────
//  PACIENTES Y EMR
// ─────────────────────────────────────────
app.get('/api/patients', (req, res) => {
  res.json(db.prepare(`
    SELECT p.*, cl.nombre as dueno, cl.telefono, cl.email
    FROM pacientes p JOIN clientes cl ON p.cliente_id=cl.id
  `).all());
});

app.post('/api/patients', (req, res) => {
  const { nombre, especie, raza, dueno, telefono, email, edad, peso } = req.body;
  const cid = db.prepare('INSERT INTO clientes(nombre,telefono,email) VALUES(?,?,?)').run(dueno, telefono, email).lastInsertRowid;
  db.prepare('INSERT INTO pacientes(nombre,especie,raza,cliente_id,edad,peso) VALUES(?,?,?,?,?,?)').run(nombre, especie, raza, cid, edad || '', peso || null);
  res.status(201).json({ ok: true });
});

app.put('/api/patients/:id', (req, res) => {
  const { nombre, especie, raza, dueno, telefono, email, edad, peso } = req.body;
  const p = db.prepare('SELECT cliente_id FROM pacientes WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Paciente no encontrado' });
  db.prepare('UPDATE clientes SET nombre=?, telefono=?, email=? WHERE id=?').run(dueno, telefono, email, p.cliente_id);
  db.prepare('UPDATE pacientes SET nombre=?, especie=?, raza=?, edad=?, peso=? WHERE id=?').run(nombre, especie, raza, edad || '', peso || null, req.params.id);
  res.json({ ok: true });
});

app.get('/api/patients/:id/medical-history', (req, res) => {
  res.json(db.prepare('SELECT * FROM historial_medico WHERE paciente_id=? ORDER BY fecha DESC, id DESC').all(req.params.id));
});

app.post('/api/patients/:id/medical-history', (req, res) => {
  const { fecha, veterinario, tipo, diagnostico, tratamiento, peso, observaciones } = req.body;
  db.prepare(`
    INSERT INTO historial_medico (paciente_id, fecha, veterinario, tipo, diagnostico, tratamiento, peso, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, fecha, veterinario, tipo, diagnostico, tratamiento, peso || null, observaciones || '');
  if (peso) {
    db.prepare('UPDATE pacientes SET peso=? WHERE id=?').run(peso, req.params.id);
  }
  res.status(201).json({ ok: true });
});

app.get('/api/patients/:id/vaccines', (req, res) => {
  res.json(db.prepare('SELECT * FROM vacunas_paciente WHERE paciente_id=? ORDER BY fecha_aplicacion DESC, id DESC').all(req.params.id));
});

app.post('/api/patients/:id/vaccines', (req, res) => {
  const { vacuna_nombre, fecha_aplicacion, fecha_proxima, lote, estado } = req.body;
  db.prepare(`
    INSERT INTO vacunas_paciente(paciente_id, vacuna_nombre, fecha_aplicacion, fecha_proxima, lote, estado)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, vacuna_nombre, fecha_aplicacion, fecha_proxima || null, lote || '', estado || 'Aplicada');
  res.status(201).json({ ok: true });
});

app.patch('/api/vaccines/:id', (req, res) => {
  const { estado, fecha_aplicacion, lote } = req.body;
  db.prepare('UPDATE vacunas_paciente SET estado=?, fecha_aplicacion=?, lote=? WHERE id=?').run(estado, fecha_aplicacion, lote || '', req.params.id);
  res.json({ ok: true });
});

app.get('/api/vaccines/reminders', (req, res) => {
  res.json(db.prepare(`
    SELECT vp.*, p.nombre as paciente, cl.nombre as dueno
    FROM vacunas_paciente vp
    JOIN pacientes p ON vp.paciente_id = p.id
    JOIN clientes cl ON p.cliente_id = cl.id
    WHERE vp.estado='Programada' AND vp.fecha_proxima IS NOT NULL
    ORDER BY vp.fecha_proxima ASC
  `).all());
});

// ─────────────────────────────────────────
//  CITAS Y DISPONIBILIDAD
// ─────────────────────────────────────────
app.get('/api/appointments', (req, res) => {
  cancelExpiredPending(db);
  res.json(db.prepare(`
    SELECT c.*, p.nombre as paciente, cl.nombre as dueno
    FROM citas c
    JOIN pacientes p  ON c.paciente_id=p.id
    JOIN clientes cl  ON p.cliente_id=cl.id
    ORDER BY c.fecha DESC, c.hora DESC
  `).all());
});

app.post('/api/appointments', (req, res) => {
  const { paciente_id, fecha, hora, servicio, monto } = req.body;
  const row = db.prepare('INSERT INTO citas(paciente_id,fecha,hora,servicio,monto,estado) VALUES(?,?,?,?,?,?)').run(paciente_id, fecha, hora, servicio, monto, 'Pendiente');
  const citaId = row.lastInsertRowid;

  // Crear la factura asociada inmediatamente en estado 'Pendiente'
  const paciente = db.prepare('SELECT cliente_id FROM pacientes WHERE id = ?').get(paciente_id);
  if (paciente) {
    const montoFinal = Number(monto);
    const subtotal = Number((montoFinal / 1.15).toFixed(2));
    const impuesto = Number((montoFinal - subtotal).toFixed(2));
    db.prepare(`
      INSERT INTO facturas(cita_id, paciente_id, cliente_id, fecha, subtotal, impuesto, total, metodo_pago, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(citaId, paciente_id, paciente.cliente_id, fecha, subtotal, impuesto, montoFinal, 'Efectivo', 'Pendiente');
  }

  res.status(201).json({ ok: true });
});

app.patch('/api/appointments/:id', (req, res) => {
  const { estado, fecha, hora, servicio, monto } = req.body;
  const id = req.params.id;

  // Construir la actualización de la cita
  if (fecha !== undefined || hora !== undefined || servicio !== undefined || monto !== undefined) {
    db.prepare('UPDATE citas SET estado=COALESCE(?,estado), fecha=COALESCE(?,fecha), hora=COALESCE(?,hora), servicio=COALESCE(?,servicio), monto=COALESCE(?,monto) WHERE id=?')
      .run(estado ?? null, fecha ?? null, hora ?? null, servicio ?? null, monto ?? null, id);
  } else {
    db.prepare('UPDATE citas SET estado=? WHERE id=?').run(estado, id);
  }

  // ── Sincronización con facturas ──
  if (estado === 'Completado') {
    const existing = db.prepare('SELECT id FROM facturas WHERE cita_id = ?').get(id);
    if (!existing) {
      const cita = db.prepare(`
        SELECT c.*, p.cliente_id 
        FROM citas c 
        JOIN pacientes p ON c.paciente_id = p.id 
        WHERE c.id = ?
      `).get(id);
      if (cita) {
        const montoFinal = Number(monto ?? cita.monto);
        const subtotal = Number((montoFinal / 1.15).toFixed(2));
        const impuesto = Number((montoFinal - subtotal).toFixed(2));
        db.prepare(`
          INSERT INTO facturas(cita_id, paciente_id, cliente_id, fecha, subtotal, impuesto, total, metodo_pago, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cita.id, cita.paciente_id, cita.cliente_id, cita.fecha, subtotal, impuesto, montoFinal, 'Efectivo', 'Pagada');
      }
    } else {
      // Si ya existía factura, marcarla como Pagada
      db.prepare("UPDATE facturas SET estado='Pagada' WHERE cita_id=?").run(id);
      if (monto !== undefined) {
        const montoFinal = Number(monto);
        const subtotal = Number((montoFinal / 1.15).toFixed(2));
        const impuesto = Number((montoFinal - subtotal).toFixed(2));
        db.prepare('UPDATE facturas SET subtotal=?, impuesto=?, total=? WHERE cita_id=?')
          .run(subtotal, impuesto, montoFinal, id);
      }
    }
  } else if (estado === 'Cancelado') {
    // Al cancelar la cita, cancelar también la factura pendiente asociada
    db.prepare('UPDATE facturas SET estado="Cancelada" WHERE cita_id=? AND estado="Pendiente"').run(id);
  } else if ((fecha || hora || servicio || monto !== undefined) && !estado) {
    // Al reprogramar (cambio de fecha/hora/servicio/monto), actualizar la factura pendiente
    if (monto !== undefined) {
      const montoFinal = Number(monto);
      const subtotal = Number((montoFinal / 1.15).toFixed(2));
      const impuesto = Number((montoFinal - subtotal).toFixed(2));
      db.prepare('UPDATE facturas SET subtotal=?, impuesto=?, total=?, fecha=COALESCE(?,fecha) WHERE cita_id=? AND estado="Pendiente"')
        .run(subtotal, impuesto, montoFinal, fecha ?? null, id);
    } else if (fecha) {
      db.prepare('UPDATE facturas SET fecha=? WHERE cita_id=? AND estado="Pendiente"').run(fecha, id);
    }
  }

  res.json({ ok: true });
});

app.get('/api/appointments/check-availability', (req, res) => {
  const { fecha, hora, exclude_id } = req.query;
  if (!fecha || !hora) return res.status(400).json({ error: 'fecha y hora requeridos' });
  let sql = "SELECT COUNT(*) as count FROM citas WHERE fecha=? AND hora=? AND estado != 'Cancelado'";
  const params = [fecha, hora];
  if (exclude_id) {
    sql += " AND id != ?";
    params.push(exclude_id);
  }
  const count = db.prepare(sql).get(...params).count;
  res.json({ disponible: count === 0 });
});

// ─────────────────────────────────────────
//  INVENTARIO
// ─────────────────────────────────────────
app.get('/api/inventory', (req, res) => {
  res.json(db.prepare('SELECT * FROM inventario').all());
});

app.get('/api/inventory/alerts', (req, res) => {
  res.json(db.prepare('SELECT * FROM inventario WHERE stock<=minimo').all());
});

app.post('/api/inventory', (req, res) => {
  const { producto, stock, minimo, precio, categoria } = req.body;
  db.prepare('INSERT INTO inventario(producto, stock, minimo, precio, categoria) VALUES(?,?,?,?,?)')
    .run(producto, stock || 0, minimo || 5, precio || 0.0, categoria || 'General');
  res.status(201).json({ ok: true });
});

app.put('/api/inventory/:id', (req, res) => {
  const { producto, stock, minimo, precio, categoria } = req.body;
  db.prepare('UPDATE inventario SET producto=?, stock=?, minimo=?, precio=?, categoria=? WHERE id=?')
    .run(producto, stock, minimo, precio, categoria, req.params.id);
  res.json({ ok: true });
});

app.patch('/api/inventory/:id', (req, res) => {
  db.prepare('UPDATE inventario SET stock=? WHERE id=?').run(req.body.stock, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/inventory/:id', (req, res) => {
  db.prepare('DELETE FROM inventario WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────
//  FACTURACIÓN Y COBROS
// ─────────────────────────────────────────
app.get('/api/invoices', (req, res) => {
  res.json(db.prepare(`
    SELECT f.*, p.nombre as paciente, cl.nombre as dueno, c.servicio
    FROM facturas f
    JOIN pacientes p ON f.paciente_id = p.id
    JOIN clientes cl ON f.cliente_id = cl.id
    LEFT JOIN citas c ON f.cita_id = c.id
    ORDER BY f.fecha DESC, f.id DESC
  `).all());
});

app.post('/api/invoices', (req, res) => {
  const { cita_id, paciente_id, fecha, total, metodo_pago, estado } = req.body;
  let pacId = paciente_id;
  let cliId;

  if (cita_id) {
    const cita = db.prepare('SELECT c.paciente_id, p.cliente_id FROM citas c JOIN pacientes p ON c.paciente_id=p.id WHERE c.id=?').get(cita_id);
    if (cita) {
      pacId = cita.paciente_id;
      cliId = cita.cliente_id;
    }
  }

  if (!cliId && pacId) {
    const p = db.prepare('SELECT cliente_id FROM pacientes WHERE id=?').get(pacId);
    if (p) cliId = p.cliente_id;
  }

  if (!pacId || !cliId) return res.status(400).json({ error: 'Paciente o cliente no válido' });

  const subtotal = Number((total / 1.16).toFixed(2));
  const impuesto = Number((total - subtotal).toFixed(2));

  const row = db.prepare(`
    INSERT INTO facturas(cita_id, paciente_id, cliente_id, fecha, subtotal, impuesto, total, metodo_pago, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cita_id || null, pacId, cliId, fecha, subtotal, impuesto, total, metodo_pago || 'Efectivo', estado || 'Pendiente');

  res.status(201).json({ id: row.lastInsertRowid, ok: true });
});

app.patch('/api/invoices/:id', (req, res) => {
  const { estado, metodo_pago } = req.body;
  db.prepare('UPDATE facturas SET estado=?, metodo_pago=? WHERE id=?').run(estado, metodo_pago, req.params.id);
  
  // Si la factura se paga y la cita asociada está 'Pendiente', pasarla a 'En Proceso'
  if (estado === 'Pagada') {
    const factura = db.prepare('SELECT cita_id FROM facturas WHERE id=?').get(req.params.id);
    if (factura && factura.cita_id) {
      const cita = db.prepare('SELECT estado FROM citas WHERE id=?').get(factura.cita_id);
      if (cita && cita.estado === 'Pendiente') {
        db.prepare("UPDATE citas SET estado='En Proceso' WHERE id=?").run(factura.cita_id);
      }
    }
  }
  
  res.json({ ok: true });
});

app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const buffer = await generateInvoicePdfBuffer(db, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura_${req.params.id}.pdf"`);
    res.send(buffer);
  } catch(err) {
    console.error('Error generando PDF de factura:', err);
    res.status(500).json({ error: 'No se pudo generar el PDF de la factura' });
  }
});

// ─────────────────────────────────────────
//  USUARIOS Y PERSONAL
// ─────────────────────────────────────────
app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT id, username, nombre, rol FROM usuarios').all());
});

app.post('/api/users', (req, res) => {
  const { username, password, nombre, rol } = req.body;
  try {
    db.prepare('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)')
      .run(username, password, nombre, rol);
    res.status(201).json({ ok: true });
  } catch(err) {
    res.status(400).json({ error: 'El nombre de usuario ya existe' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────
//  ANALÍTICA (Reportes MIS)
// ─────────────────────────────────────────
app.get('/api/analytics', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'Parámetros start y end requeridos' });
  }
  if (start > end) {
    return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior al fin' });
  }
  try {
    res.json(buildClientAnalytics(db, start, end));
  } catch (err) {
    console.error('Error en analítica:', err);
    res.status(500).json({ error: 'No se pudo calcular la analítica', detail: err.message });
  }
});

// ─────────────────────────────────────────
//  REPORTES (PDF + Excel)
// ─────────────────────────────────────────
async function sendReport(res, type, start, end) {
  const filename = `vetmis_${start}_${end}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
  if (type === 'pdf') {
    const buffer = await generatePdfBuffer(db, start, end);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
  const buffer = await generateExcelBuffer(db, start, end);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
}

app.get('/api/reports/:type', async (req, res) => {
  const { type } = req.params;
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: 'Parámetros start y end requeridos' });
  }
  if (!['pdf', 'excel'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de reporte no válido' });
  }
  try {
    await sendReport(res, type, start, end);
  } catch (err) {
    console.error('Error generando reporte:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'No se pudo generar el reporte', detail: err.message });
    }
  }
});

app.post('/api/reports/pdf', async (req, res) => {
  const { start, end } = req.body || {};
  if (!start || !end) {
    return res.status(400).json({ error: 'Parámetros start y end requeridos' });
  }
  try {
    await sendReport(res, 'pdf', start, end);
  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).json({ error: 'No se pudo generar el PDF' });
  }
});

// ─────────────────────────────────────────
//  FRONTEND (producción empaquetada)
// ─────────────────────────────────────────
const distIndex = path.join(clientDist, 'index.html');
if (fs.existsSync(distIndex)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(distIndex);
  });
}

app.listen(PORT, () => {
  const mode = fs.existsSync(distIndex) ? 'App' : 'API';
  console.log(`✅  VET-MIS ${mode} → http://localhost:${PORT}`);
  cancelExpiredPending(db);
  setInterval(() => cancelExpiredPending(db), 5 * 60 * 1000);
});
