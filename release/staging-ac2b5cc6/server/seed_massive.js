const Database = require('better-sqlite3');
const db = new Database('vet_mis.db');

db.prepare('PRAGMA foreign_keys = OFF').run();
db.prepare('DELETE FROM clientes').run();
db.prepare('DELETE FROM pacientes').run();
db.prepare('DELETE FROM citas').run();
db.prepare('DELETE FROM sqlite_sequence').run();
db.prepare('PRAGMA foreign_keys = ON').run();

// 1. Clientes
const insertCliente = db.prepare('INSERT INTO clientes(nombre, telefono, email) VALUES(?,?,?)');
const nombresClientes = ['Carlos Slim', 'María Antonieta', 'Juan Pérez', 'Luisa Lane', 'Bruce Wayne', 'Clark Kent', 'Diana Prince', 'Arthur Curry', 'Barry Allen', 'Hal Jordan', 'Victor Stone', 'Oliver Queen', 'Dinah Lance', 'John Diggle', 'Felicity Smoak'];
nombresClientes.forEach(n => insertCliente.run(n, '555-010' + Math.floor(Math.random()*9), n.split(' ')[0].toLowerCase()+'@email.com'));

// 2. Pacientes
const insertPaciente = db.prepare('INSERT INTO pacientes(cliente_id, nombre, especie) VALUES(?,?,?)');
const especiesData = [
  { e: 'Canino', r: ['Labrador', 'Pug', 'Bulldog', 'Poodle', 'Pastor Alemán', 'Chihuahua', 'Golden Retriever', 'Husky'] },
  { e: 'Felino', r: ['Siamés', 'Persa', 'Maine Coon', 'Bengala', 'Esfinge', 'Mestizo'] },
  { e: 'Ave', r: ['Canario', 'Cacatúa', 'Loro', 'Periquito'] },
  { e: 'Reptil', r: ['Iguana', 'Gecko', 'Tortuga', 'Serpiente'] },
  { e: 'Roedor', r: ['Hámster', 'Cobaya', 'Chinchilla'] }
];

const nombresMascotas = ['Boby', 'Luna', 'Max', 'Bella', 'Rocky', 'Coco', 'Thor', 'Simba', 'Nala', 'Milo', 'Kira', 'Toby', 'Lola', 'Bimba', 'Bruno', 'Mia', 'Zeus', 'Nena', 'Sasha', 'Rex', 'Odin', 'Fiona', 'Goliath', 'Kiwi', 'Mango', 'Paco', 'Rayo', 'Nina', 'Lili', 'Lucas'];

for (let i = 0; i < 35; i++) {
  const clienteId = Math.floor(Math.random() * nombresClientes.length) + 1;
  const nombre = nombresMascotas[Math.floor(Math.random() * nombresMascotas.length)];
  const espObj = especiesData[Math.floor(Math.random() * especiesData.length)];
  insertPaciente.run(clienteId, nombre, espObj.e);
}

// 3. Citas (150 citas en 6 meses)
const insertCita = db.prepare('INSERT INTO citas(paciente_id, fecha, hora, servicio, monto, estado) VALUES(?,?,?,?,?,?)');
const serviciosData = [
  { s: 'Consulta General', m: 50 },
  { s: 'Vacunación', m: 35 },
  { s: 'Desparasitación', m: 25 },
  { s: 'Estética', m: 60 },
  { s: 'Urgencia', m: 120 },
  { s: 'Cirugía', m: 350 },
  { s: 'Control Post-Op', m: 40 },
  { s: 'Ecografía', m: 80 },
  { s: 'Laboratorio', m: 65 }
];

const today = new Date();
for (let i = 0; i < 150; i++) {
  const pacienteId = Math.floor(Math.random() * 35) + 1;
  const servObj = serviciosData[Math.floor(Math.random() * serviciosData.length)];
  
  // Random date between -180 and +7 days
  const offset = Math.floor(Math.random() * 187) - 180;
  const d = new Date(today);
  d.setDate(today.getDate() + offset);
  const fechaStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  
  // Random hour
  const h = Math.floor(Math.random() * 10) + 8; // 8 to 17
  const horaStr = String(h).padStart(2, '0') + ':00';
  
  // Si la fecha es en el futuro, es Pendiente. Si es en el pasado, 90% Completado, 10% Cancelado
  let estado = 'Pendiente';
  if (offset < 0) {
    estado = Math.random() > 0.1 ? 'Completado' : 'Cancelado';
  } else if (offset === 0) {
    estado = Math.random() > 0.5 ? 'Completado' : 'Pendiente';
  }

  // Monto con pequeña variación
  const monto = servObj.m + (Math.floor(Math.random() * 20) - 10);
  
  insertCita.run(pacienteId, fechaStr, horaStr, servObj.s, monto, estado);
}

console.log("Semilla masiva insertada correctamente.");
