/**
 * seed-firebase.mjs
 * Inserta datos de demostración en Firestore para el proyecto VET-MIS.
 * Ejecutar con: node scripts/seed-firebase.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Leer el projectId directamente del firebaseConfig del cliente ───────────
const configPath = join(__dirname, '../client/src/firebaseConfig.js');
const configText = readFileSync(configPath, 'utf-8');
const projectIdMatch = configText.match(/projectId:\s*["']([^"']+)["']/);
const PROJECT_ID = projectIdMatch ? projectIdMatch[1] : 'vet-admin-55453';

// ─── Inicializar Firebase Admin (emulador local) ─────────────────────────────
if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

// Apuntar al emulador si está disponible, o conectar directamente.
// Si no tienes credenciales de servicio, puedes usar el emulador local de Firestore.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '';

const db = getFirestore();

// ─── Fechas de referencia ────────────────────────────────────────────────────
const hoy = new Date();
const fmt = (d) => d.toISOString().split('T')[0];
const pastDate = (days) => fmt(new Date(hoy.getTime() - days * 86400000));
const futureDate = (days) => fmt(new Date(hoy.getTime() + days * 86400000));

// ─── Datos de demo ───────────────────────────────────────────────────────────
const DEMO_PATIENTS = [
  {
    paciente: {
      nombre: 'Rocky',
      especie: 'Canino',
      raza: 'Labrador Retriever',
      dueno: 'María López',
      telefono: '9876-5432',
      email: 'maria.lopez@correo.com',
      edad: '4 años',
      peso: 28.5,
    },
    historial: [
      {
        fecha: pastDate(180),
        veterinario: 'Dr. Carlos Pérez',
        tipo: 'Consulta',
        diagnostico: 'Dermatitis alérgica leve. Enrojecimiento e irritación en patas delanteras.',
        tratamiento: 'Baño semanal con shampoo hipoalergénico. Loratadina 5mg cada 12h por 10 días.',
        peso: 27.8,
        observaciones: 'Dueña reporta que el perro tuvo contacto con césped recién cortado. Evitar zonas de pasto.',
      },
      {
        fecha: pastDate(90),
        veterinario: 'Dr. Carlos Pérez',
        tipo: 'Seguimiento',
        diagnostico: 'Mejoría notable de la dermatitis. Piel en buen estado.',
        tratamiento: 'Continuar shampoo mensual preventivo. No requiere medicación adicional.',
        peso: 28.0,
        observaciones: 'Paciente en buenas condiciones generales. Peso estable.',
      },
      {
        fecha: pastDate(15),
        veterinario: 'Dr. Carlos Pérez',
        tipo: 'Consulta',
        diagnostico: 'Revisión anual de rutina. Paciente saludable. Dientes con leve sarro.',
        tratamiento: 'Limpieza dental programada. Aplicar gel dental veterinario 3 veces/semana.',
        peso: 28.5,
        observaciones: 'Se recomienda reducir snacks. Buen estado físico general.',
      },
    ],
    vacunas: [
      {
        vacuna_nombre: 'Antirrábica',
        fecha_aplicacion: pastDate(365),
        fecha_proxima: futureDate(0),
        lote: 'LOTE-RB2024-001',
        estado: 'Programada',
      },
      {
        vacuna_nombre: 'Séxtuple Canina (DHPPI+L)',
        fecha_aplicacion: pastDate(300),
        fecha_proxima: futureDate(65),
        lote: 'LOTE-6C2024-012',
        estado: 'Aplicada',
      },
      {
        vacuna_nombre: 'Bordetella (Tos de las perreras)',
        fecha_aplicacion: pastDate(120),
        fecha_proxima: futureDate(245),
        lote: 'LOTE-BOR2024-07',
        estado: 'Aplicada',
      },
    ],
  },
  {
    paciente: {
      nombre: 'Michi',
      especie: 'Felino',
      raza: 'Maine Coon',
      dueno: 'Jorge Ramírez',
      telefono: '8765-4321',
      email: 'jorge.ramirez@email.com',
      edad: '2 años',
      peso: 5.8,
    },
    historial: [
      {
        fecha: pastDate(200),
        veterinario: 'Dra. Ana Solano',
        tipo: 'Consulta',
        diagnostico: 'Infección de vías urinarias bajas (FLUTD). Hematuria leve y disuria.',
        tratamiento: 'Amoxicilina + ácido clavulánico 62.5mg c/12h por 7 días. Dieta húmeda exclusiva. Aumentar ingesta de agua.',
        peso: 5.5,
        observaciones: 'Análisis de orina: cristales de estruvita. Se recomienda dieta prescrita Royal Canin Urinary SO.',
      },
      {
        fecha: pastDate(185),
        veterinario: 'Dra. Ana Solano',
        tipo: 'Seguimiento',
        diagnostico: 'Resolución completa de la infección urinaria. Sin signos de disuria.',
        tratamiento: 'Mantener dieta húmeda y agua fresca siempre disponible. Control en 6 meses.',
        peso: 5.7,
        observaciones: 'Orina sin cristales. Paciente activo y jugando normalmente.',
      },
      {
        fecha: pastDate(30),
        veterinario: 'Dra. Ana Solano',
        tipo: 'Diagnóstico',
        diagnostico: 'Revisión de rutina. Detección de parásitos intestinales (Toxocara cati) en análisis coprológico.',
        tratamiento: 'Fenbendazol 50mg/kg por 3 días. Repetir desparasitación en 21 días.',
        peso: 5.8,
        observaciones: 'Dueño reporta que el gato tiene acceso al exterior ocasionalmente. Recomendar collar antipulgas.',
      },
    ],
    vacunas: [
      {
        vacuna_nombre: 'Triple Felina (Herpesvirus, Calicivirus, Panleucopenia)',
        fecha_aplicacion: pastDate(365),
        fecha_proxima: futureDate(0),
        lote: 'LOTE-TF2024-031',
        estado: 'Programada',
      },
      {
        vacuna_nombre: 'Leucemia Felina (FeLV)',
        fecha_aplicacion: pastDate(200),
        fecha_proxima: futureDate(165),
        lote: 'LOTE-FeLV2024-08',
        estado: 'Aplicada',
      },
      {
        vacuna_nombre: 'Rabia Felina',
        fecha_aplicacion: pastDate(200),
        fecha_proxima: futureDate(165),
        lote: 'LOTE-RF2024-15',
        estado: 'Aplicada',
      },
    ],
  },
  {
    paciente: {
      nombre: 'Coco',
      especie: 'Ave',
      raza: 'Periquito Australiano',
      dueno: 'Sandra Molina',
      telefono: '7654-3210',
      email: 'sandra.molina@mail.com',
      edad: '3 años',
      peso: 0.045,
    },
    historial: [
      {
        fecha: pastDate(120),
        veterinario: 'Dr. Luis Mora',
        tipo: 'Consulta',
        diagnostico: 'Ácaro plumífero (Knemidokoptes pilae). Costras queratósicas en pico y alrededor de ojos.',
        tratamiento: 'Ivermectina al 1% tópica (1 gota en piel de cuello). Repetir en 10 días x 3 dosis. Desinfectar jaula con calor.',
        peso: 0.042,
        observaciones: 'Jaula con espacio reducido. Recomendar jaula más amplia y exposición solar controlada.',
      },
      {
        fecha: pastDate(90),
        veterinario: 'Dr. Luis Mora',
        tipo: 'Seguimiento',
        diagnostico: 'Regresión de costras en pico. Recuperación de plumas en zonas afectadas.',
        tratamiento: 'Tercera y última dosis de Ivermectina tópica. Vitaminas A y E en agua durante 15 días.',
        peso: 0.044,
        observaciones: 'Mejoría evidente. Pájaro activo y vocalizando normalmente.',
      },
    ],
    vacunas: [
      {
        vacuna_nombre: 'Polyomavirus Aviario',
        fecha_aplicacion: pastDate(300),
        fecha_proxima: futureDate(65),
        lote: 'LOTE-PAV2024-02',
        estado: 'Aplicada',
      },
    ],
  },
  {
    paciente: {
      nombre: 'Thor',
      especie: 'Canino',
      raza: 'Pastor Alemán',
      dueno: 'Roberto Castro',
      telefono: '6543-2109',
      email: 'roberto.castro@correo.hn',
      edad: '6 años',
      peso: 34.2,
    },
    historial: [
      {
        fecha: pastDate(365),
        veterinario: 'Dr. Carlos Pérez',
        tipo: 'Consulta',
        diagnostico: 'Displasia de cadera leve-moderada. Cojera en tren posterior después de ejercicio intenso.',
        tratamiento: 'Meloxicam 0.1mg/kg cada 24h por 30 días. Omega 3 (EPA/DHA) 1000mg/día. Hidroterapia 2x/semana.',
        peso: 35.0,
        observaciones: 'Radiografías muestran leve remodelación acetabular bilateral. Se descarta cirugía por ahora.',
      },
      {
        fecha: pastDate(270),
        veterinario: 'Dr. Carlos Pérez',
        tipo: 'Seguimiento',
        diagnostico: 'Mejoría funcional con tratamiento. Cojera ocasional solo después de ejercicio intenso.',
        tratamiento: 'Reducir distancia de caminatas a 30 min máximo. Continuar omega 3. Condroitín + glucosamina.',
        peso: 34.5,
        observaciones: 'Dueño reporta mejor calidad de vida. Recomendar piscina para ejercicio sin impacto.',
      },
      {
        fecha: pastDate(30),
        veterinario: 'Dr. Carlos Pérez',
        tipo: 'Consulta',
        diagnostico: 'Otitis externa unilateral (oído derecho). Exudado parduzco, prurito intenso.',
        tratamiento: 'Limpieza con Otomax solución. Mometasona + gentamicina gotas, 5 gotas c/12h por 7 días.',
        peso: 34.2,
        observaciones: 'Cultivo pendiente. Evitar agua en oídos. Control en 10 días.',
      },
    ],
    vacunas: [
      {
        vacuna_nombre: 'Antirrábica',
        fecha_aplicacion: pastDate(200),
        fecha_proxima: futureDate(165),
        lote: 'LOTE-RB2024-042',
        estado: 'Aplicada',
      },
      {
        vacuna_nombre: 'Séxtuple Canina',
        fecha_aplicacion: pastDate(200),
        fecha_proxima: futureDate(165),
        lote: 'LOTE-6C2024-038',
        estado: 'Aplicada',
      },
      {
        vacuna_nombre: 'Leptospirosis',
        fecha_aplicacion: pastDate(90),
        fecha_proxima: futureDate(275),
        lote: 'LOTE-LEPT2025-03',
        estado: 'Aplicada',
      },
    ],
  },
  {
    paciente: {
      nombre: 'Bella',
      especie: 'Felino',
      raza: 'Persa',
      dueno: 'Claudia Herrera',
      telefono: '5432-1098',
      email: 'claudia.herrera@email.hn',
      edad: '7 años',
      peso: 4.1,
    },
    historial: [
      {
        fecha: pastDate(150),
        veterinario: 'Dra. Ana Solano',
        tipo: 'Diagnóstico',
        diagnostico: 'Enfermedad renal crónica (ERC) estadio 2. Valores de creatinina elevados (2.1 mg/dL).',
        tratamiento: 'Dieta renal (Hill\'s k/d o Royal Canin Renal). Benazepril 2.5mg c/24h. Control de hidratación.',
        peso: 4.3,
        observaciones: 'Control con perfil renal completo cada 3 meses. Monitorear consumo de agua y orina.',
      },
      {
        fecha: pastDate(60),
        veterinario: 'Dra. Ana Solano',
        tipo: 'Seguimiento',
        diagnostico: 'ERC estable. Creatinina 2.0 mg/dL. Sin progresión. Paciente comedera y activa.',
        tratamiento: 'Continuar dieta renal y benazepril. Probiótico intestinal (Fortiflora) mensual.',
        peso: 4.1,
        observaciones: 'Dueña muy comprometida con la dieta. Excelente pronóstico de mantenimiento.',
      },
    ],
    vacunas: [
      {
        vacuna_nombre: 'Triple Felina',
        fecha_aplicacion: pastDate(400),
        fecha_proxima: pastDate(35),
        lote: 'LOTE-TF2023-18',
        estado: 'Programada',
      },
      {
        vacuna_nombre: 'Rabia Felina',
        fecha_aplicacion: pastDate(400),
        fecha_proxima: pastDate(35),
        lote: 'LOTE-RF2023-22',
        estado: 'Programada',
      },
    ],
  },
];

// ─── Insertar datos ──────────────────────────────────────────────────────────
async function seedData() {
  console.log(`\n🐾 Iniciando siembra de datos demo en Firebase (Proyecto: ${PROJECT_ID})...\n`);

  let totalPacientes = 0;
  let totalHistorial = 0;
  let totalVacunas = 0;

  for (const demo of DEMO_PATIENTS) {
    try {
      // 1. Crear paciente
      const pacRef = await db.collection('patients').add(demo.paciente);
      console.log(`✅ Paciente creado: ${demo.paciente.nombre} (${demo.paciente.especie}) → ID: ${pacRef.id}`);
      totalPacientes++;

      // 2. Agregar historial médico
      for (const h of demo.historial) {
        await db.collection(`patients/${pacRef.id}/medical-history`).add(h);
        totalHistorial++;
      }
      console.log(`   📋 ${demo.historial.length} registros de historial clínico insertados.`);

      // 3. Agregar vacunas
      for (const v of demo.vacunas) {
        await db.collection(`patients/${pacRef.id}/vaccines`).add(v);
        totalVacunas++;
      }
      console.log(`   💉 ${demo.vacunas.length} vacunas insertadas.\n`);

    } catch (err) {
      console.error(`❌ Error al insertar ${demo.paciente.nombre}:`, err.message);
    }
  }

  console.log('─'.repeat(50));
  console.log(`🎉 Siembra completada:`);
  console.log(`   🐶 Pacientes:  ${totalPacientes}`);
  console.log(`   📋 Historial:  ${totalHistorial} registros`);
  console.log(`   💉 Vacunas:    ${totalVacunas} registros`);
  console.log('─'.repeat(50));
  process.exit(0);
}

seedData().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
