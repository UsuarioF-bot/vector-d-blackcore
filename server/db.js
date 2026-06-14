const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'vet_mis.db'));

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    especie TEXT,
    raza TEXT,
    cliente_id INTEGER,
    edad TEXT,
    peso REAL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS citas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER,
    fecha DATE NOT NULL,
    hora TEXT,
    servicio TEXT,
    estado TEXT DEFAULT 'Pendiente',
    monto DECIMAL(10, 2),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
  );

  CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto TEXT NOT NULL,
    stock INTEGER DEFAULT 0,
    minimo INTEGER DEFAULT 5,
    precio DECIMAL(10, 2),
    categoria TEXT
  );

  CREATE TABLE IF NOT EXISTS historial_medico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    veterinario TEXT,
    tipo TEXT,
    diagnostico TEXT,
    tratamiento TEXT,
    peso REAL,
    observaciones TEXT,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
  );

  CREATE TABLE IF NOT EXISTS vacunas_paciente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    vacuna_nombre TEXT NOT NULL,
    fecha_aplicacion DATE NOT NULL,
    fecha_proxima DATE,
    lote TEXT,
    estado TEXT DEFAULT 'Aplicada',
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
  );

  CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cita_id INTEGER,
    paciente_id INTEGER,
    cliente_id INTEGER,
    fecha DATE NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    impuesto DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    metodo_pago TEXT,
    estado TEXT DEFAULT 'Pendiente',
    FOREIGN KEY (cita_id) REFERENCES citas(id),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL
  );
`);

// Migración segura para base de datos existente
try { db.exec("ALTER TABLE pacientes ADD COLUMN edad TEXT;"); } catch(e){}
try { db.exec("ALTER TABLE pacientes ADD COLUMN peso REAL;"); } catch(e){}

// Insertar datos iniciales si las tablas están vacías
const seedData = () => {
  // 1. Usuarios (Siempre asegurar que existan los requeridos)
  const countUsers = db.prepare('SELECT count(*) as count FROM usuarios').get().count;
  if (countUsers === 0) {
    const insertUser = db.prepare('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)');
    insertUser.run('admin', '1', 'Administrador General', 'Administrador');
    insertUser.run('vet', '1', 'Dr. Carlos Pérez', 'Veterinario');
    insertUser.run('recep', '1', 'Ana Gómez', 'Recepcionista');
    console.log("Usuarios demo creados (contraseña: 1).");
  }

  const row = db.prepare('SELECT count(*) as count FROM clientes').get();
  if (row.count === 0) {
    // Clientes y Pacientes
    const insertCliente = db.prepare('INSERT INTO clientes (nombre, telefono, email) VALUES (?, ?, ?)');
    const insertPaciente = db.prepare('INSERT INTO pacientes (nombre, especie, raza, cliente_id, edad, peso) VALUES (?, ?, ?, ?, ?, ?)');
    
    const c1 = insertCliente.run('Carlos Ruiz', '555-0101', 'carlos@email.com').lastInsertRowid;
    const c2 = insertCliente.run('Ana Garcia', '555-0102', 'ana@email.com').lastInsertRowid;
    const c3 = insertCliente.run('Pedro Soto', '555-0103', 'pedro@email.com').lastInsertRowid;

    const p1 = insertPaciente.run('Toby', 'Canino', 'Golden Retriever', c1, '3 años', 30.5).lastInsertRowid;
    const p2 = insertPaciente.run('Luna', 'Felino', 'Siamés', c2, '2 años', 4.2).lastInsertRowid;
    const p3 = insertPaciente.run('Max', 'Canino', 'Bulldog', c3, '5 años', 22.1).lastInsertRowid;
    const p4 = insertPaciente.run('Mimi', 'Felino', 'Persa', c2, '6 meses', 2.5).lastInsertRowid;

    // Historial clínico de ejemplo
    const insertHistorial = db.prepare(`INSERT INTO historial_medico (paciente_id, fecha, veterinario, tipo, diagnostico, tratamiento, peso, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertHistorial.run(p1, '2026-04-15', 'Dr. Carlos Pérez', 'Consulta', 'Otitis externa bilateral', 'Limpieza y gotas óticas c/12h por 7 días', 30.2, 'Se recomienda control en una semana.');
    insertHistorial.run(p2, '2026-05-10', 'Dr. Carlos Pérez', 'Consulta', 'Gastroenteritis leve', 'Dieta blanda y antiparasitario de amplio espectro', 4.1, 'Dueño reporta vómitos ocasionales.');
    insertHistorial.run(p3, '2026-05-12', 'Dr. Carlos Pérez', 'Consulta', 'Dermatitis atópica', 'Shampoo medicado c/3 días y antihistamínicos', 22.1, 'Monitorear rascado o enrojecimiento.');
    insertHistorial.run(p4, '2026-05-18', 'Dr. Carlos Pérez', 'Consulta', 'Desparasitación de rutina', 'Antiparasitario de amplio espectro vía oral', 2.5, 'Control de peso normal, cachorro saludable.');

    // Vacunas de ejemplo
    const insertVacuna = db.prepare(`INSERT INTO vacunas_paciente (paciente_id, vacuna_nombre, fecha_aplicacion, fecha_proxima, lote, estado) VALUES (?, ?, ?, ?, ?, ?)`);
    insertVacuna.run(p1, 'Antirrábica', '2026-01-10', '2027-01-10', 'LOTE-A9912', 'Aplicada');
    insertVacuna.run(p1, 'Séxtuple Canina', '2026-05-10', '2027-05-10', 'LOTE-S4412', 'Aplicada');
    insertVacuna.run(p2, 'Triple Felina', '2026-03-20', '2027-03-20', 'LOTE-TF221', 'Aplicada');
    insertVacuna.run(p2, 'Leucemia Felina (Refuerzo)', '2026-05-20', '2026-06-20', 'LOTE-LF77', 'Programada');
    insertVacuna.run(p3, 'Antirrábica', '2026-02-15', '2027-02-15', 'LOTE-AR712', 'Aplicada');
    insertVacuna.run(p3, 'Séxtuple Canina', '2026-05-01', '2027-05-01', 'LOTE-S3312', 'Aplicada');
    insertVacuna.run(p4, 'Triple Felina', '2026-04-10', '2027-04-10', 'LOTE-TF112', 'Aplicada');
    insertVacuna.run(p4, 'Leucemia Felina', '2026-06-15', '2026-07-15', 'LOTE-LF99', 'Programada');

    // Seed Citas (Historial masivo para reportes)
    const countCitas = db.prepare("SELECT COUNT(*) as count FROM citas").get().count;
    if (countCitas === 0) {
      const insertCita = db.prepare(`INSERT INTO citas (paciente_id, fecha, hora, servicio, estado, monto) VALUES (?, ?, ?, ?, ?, ?)`);
      const insertFactura = db.prepare(`INSERT INTO facturas (cita_id, paciente_id, cliente_id, fecha, subtotal, impuesto, total, metodo_pago, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      const servicios = [
        { n: 'Consulta General', m: 45.0, c: 'Farmacia' },
        { n: 'Vacunación', m: 35.0, c: 'Farmacia' },
        { n: 'Desparasitación', m: 25.0, c: 'Farmacia' },
        { n: 'Urgencia', m: 120.0, c: 'Farmacia' },
        { n: 'Cirugía', m: 350.0, c: 'Farmacia' }
      ];

      // Citas manuales recientes
      const cit1 = insertCita.run(p1, new Date().toISOString().split('T')[0], '10:00', 'Consulta General', 'Pendiente', 45.50).lastInsertRowid;
      const cit2 = insertCita.run(p2, new Date().toISOString().split('T')[0], '11:30', 'Vacunación', 'Completado', 35.00).lastInsertRowid;
      
      // Factura para cita completada
      insertFactura.run(cit2, p2, c2, new Date().toISOString().split('T')[0], 29.41, 5.59, 35.00, 'Efectivo', 'Pagada');

      // Sembrar 80 citas a lo largo de los últimos 365 días y sus facturas
      const hoy = new Date();
      const metodos = ['Efectivo', 'Tarjeta', 'Transferencia'];
      for (let i = 0; i < 80; i++) {
        const diasAtras = Math.floor(Math.random() * 365);
        const fecha = new Date(hoy.getTime() - diasAtras * 24 * 60 * 60 * 1000);
        const fechaStr = fecha.toISOString().split('T')[0];
        
        const srv = servicios[Math.floor(Math.random() * servicios.length)];
        const pId = Math.floor(Math.random() * 4) + 1; // Toby, Luna, Max o Mimi
        let cId = c1;
        if (pId === 2 || pId === 4) cId = c2;
        if (pId === 3) cId = c3;
        
        const citaId = insertCita.run(pId, fechaStr, '12:00', srv.n, 'Completado', srv.m).lastInsertRowid;
        
        // Crear factura pagada para reflejar ingresos (ISV 15% Honduras)
        const total = srv.m;
        const subtotal = Number((total / 1.15).toFixed(2));
        const impuesto = Number((total - subtotal).toFixed(2));
        const mp = metodos[Math.floor(Math.random() * metodos.length)];
        insertFactura.run(citaId, pId, cId, fechaStr, subtotal, impuesto, total, mp, 'Pagada');
      }
      console.log("Historial de citas y facturas sembrado.");
    }

    // Inventario
    const insertInv = db.prepare('INSERT INTO inventario (producto, stock, minimo, precio, categoria) VALUES (?, ?, ?, ?, ?)');
    insertInv.run('Amoxicilina 250mg', 2, 10, 15.50, 'Medicamentos');
    insertInv.run('Vacuna triple felina', 8, 5, 35.00, 'Vacunas');
    insertInv.run('Alimento Renal 2kg', 5, 5, 35.00, 'Productos');
    insertInv.run('Shampoo Medicado', 20, 5, 12.00, 'Insumos');
    insertInv.run('Pipeta Antipulgas', 15, 8, 8.50, 'Medicamentos');
    insertInv.run('Ivermectina', 3, 5, 25.00, 'Medicamentos');
    insertInv.run('Meloxicam 15mg', 12, 5, 18.00, 'Medicamentos');
    insertInv.run('Cefalexina 250mg', 4, 10, 20.00, 'Medicamentos');
    insertInv.run('Shampoo Hipoalergénico', 10, 5, 15.00, 'Insumos');
  }
};

seedData();

const syncFacturas = () => {
  // Sincronizar todas las citas existentes que no tienen facturas
  const citasSinFactura = db.prepare(`
    SELECT c.*, p.cliente_id 
    FROM citas c 
    JOIN pacientes p ON c.paciente_id = p.id 
    WHERE c.id NOT IN (SELECT DISTINCT cita_id FROM facturas WHERE cita_id IS NOT NULL)
  `).all();
  
  if (citasSinFactura.length > 0) {
    const insertFactura = db.prepare(`
      INSERT INTO facturas (cita_id, paciente_id, cliente_id, fecha, subtotal, impuesto, total, metodo_pago, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const metodos = ['Efectivo', 'Tarjeta', 'Transferencia'];
    db.transaction(() => {
      for (const c of citasSinFactura) {
        const subtotal = Number((c.monto / 1.15).toFixed(2));
        const impuesto = Number((c.monto - subtotal).toFixed(2));
        const mp = metodos[Math.floor(Math.random() * metodos.length)];
        
        let estadoFactura = 'Pendiente';
        if (c.estado === 'Completado') {
          estadoFactura = 'Pagada';
        } else if (c.estado === 'Cancelado') {
          estadoFactura = 'Cancelada';
        }
        
        insertFactura.run(c.id, c.paciente_id, c.cliente_id, c.fecha, subtotal, impuesto, c.monto, mp, estadoFactura);
      }
    })();
    console.log(`✅ Sincronizadas ${citasSinFactura.length} facturas para citas existentes.`);
  }

  // Si la tabla facturas sigue vacía, creamos facturas de prueba (tanto pagadas como pendientes)
  const countFacturas = db.prepare('SELECT count(*) as count FROM facturas').get().count;
  if (countFacturas <= 5) {
    const insertFactura = db.prepare(`
      INSERT INTO facturas (paciente_id, cliente_id, fecha, subtotal, impuesto, total, metodo_pago, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const hoy = new Date();
    for (let i = 0; i < 20; i++) {
      const diasAtras = i * 2;
      const fecha = new Date(hoy.getTime() - diasAtras * 24 * 60 * 60 * 1000);
      const fechaStr = fecha.toISOString().split('T')[0];
      const total = 150.0 + Math.floor(Math.random() * 800); // Montos en Lempiras
      const subtotal = Number((total / 1.15).toFixed(2));
      const impuesto = Number((total - subtotal).toFixed(2));
      const metodos = ['Efectivo', 'Tarjeta', 'Transferencia'];
      const mp = metodos[Math.floor(Math.random() * metodos.length)];
      const estado = Math.random() > 0.25 ? 'Pagada' : 'Pendiente';
      
      const pId = (i % 4) + 1; // Toby, Luna, Max, Mimi
      let cId = 1;
      if (pId === 2 || pId === 4) cId = 2;
      if (pId === 3) cId = 3;
      
      insertFactura.run(pId, cId, fechaStr, subtotal, impuesto, total, mp, estado);
    }
    console.log("✅ Sembradas facturas de prueba manuales adicionales.");
  }
};

syncFacturas();

module.exports = db;
