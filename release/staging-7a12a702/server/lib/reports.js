const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const ExcelJS = require('exceljs');
const { parseLocalDate, diffDaysInclusive, eachDayInRange, localDateStr } = require('./dates');

const BRAND = {
  primary: [15, 118, 110],
  primaryDark: [13, 94, 88],
  accent: [14, 165, 233],
  violet: [139, 92, 246],
  amber: [245, 158, 11],
  success: [34, 197, 94],
  danger: [239, 68, 68],
  slate: [30, 41, 59],
  muted: [100, 116, 139],
  light: [241, 245, 249],
};

const CONSUMOS_MAP = {
  Vacunación: 'Vacuna triple felina',
  Desparasitación: 'Ivermectina',
  Urgencia: 'Meloxicam 15mg',
  'Consulta General': 'Amoxicilina 500mg',
  Cirugía: 'Cefalexina 250mg',
  Estética: 'Shampoo Hipoalergénico',
  'Control Post-Op': 'Cefalexina 250mg',
};

const CHART_COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6'];

const fmtMoney = (n) => {
  const formatted = new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `L ${formatted}`;
};

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function estimateProductForService(servicio) {
  if (servicio === 'Vacunación') return 'Vacuna triple felina';
  if (servicio === 'Desparasitación') return 'Ivermectina';
  if (servicio.includes('Consulta')) return 'Amoxicilina 500mg';
  if (servicio === 'Urgencia') return 'Meloxicam 15mg';
  if (servicio === 'Cirugía') return 'Cefalexina 250mg';
  if (servicio === 'Estética') return 'Shampoo Hipoalergénico';
  if (servicio === 'Control Post-Op') return 'Cefalexina 250mg';
  return null;
}

const countPendientesVigentes = (rows, start, end) => {
  const hoy = todayStr();
  const desde = start > hoy ? start : hoy;
  return rows.filter(
    (r) => r.estado === 'Pendiente' && r.fecha >= desde && r.fecha <= end
  ).length;
};

const fmtPeriod = (start, end) => `${fmtDate(start)} — ${fmtDate(end)}`;

function fetchAppointments(db, start, end) {
  return db
    .prepare(
      `
    SELECT c.fecha, c.paciente_id, p.nombre as paciente, p.especie, c.servicio, c.monto, c.estado
    FROM citas c JOIN pacientes p ON c.paciente_id = p.id
    WHERE c.fecha BETWEEN ? AND ? ORDER BY c.fecha ASC
  `
    )
    .all(start, end);
}

function fetchInvoicesInPeriod(db, start, end) {
  return db
    .prepare(
      `
    SELECT f.fecha, f.total, f.estado, f.metodo_pago, f.paciente_id, p.nombre as paciente, p.especie, c.servicio
    FROM facturas f
    JOIN pacientes p ON f.paciente_id = p.id
    LEFT JOIN citas c ON f.cita_id = c.id
    WHERE f.fecha BETWEEN ? AND ?
    ORDER BY f.fecha ASC
  `
    )
    .all(start, end);
}

function fetchPaidInvoices(db, start, end) {
  return fetchInvoicesInPeriod(db, start, end).filter((f) => f.estado === 'Pagada');
}

function buildAnalytics(db, start, end) {
  const rows = fetchAppointments(db, start, end);
  const completadas = rows.filter((r) => r.estado === 'Completado');
  const facturasPeriodo = fetchInvoicesInPeriod(db, start, end);
  const facturasPagadas = facturasPeriodo.filter((f) => f.estado === 'Pagada');
  const totalIngresos = facturasPagadas.reduce((s, r) => s + Number(r.total), 0);
  const totalPendiente = facturasPeriodo
    .filter((f) => f.estado === 'Pendiente')
    .reduce((s, r) => s + Number(r.total), 0);
  const ticketPromedio = facturasPagadas.length ? totalIngresos / facturasPagadas.length : 0;
  const tasaCompletado = rows.length ? (completadas.length / rows.length) * 100 : 0;

  const tipos = {};
  rows.forEach((c) => {
    tipos[c.servicio] = (tipos[c.servicio] || 0) + 1;
  });

  const especies = {};
  rows.forEach((c) => {
    especies[c.especie] = (especies[c.especie] || 0) + 1;
  });

  const diffDays = diffDaysInclusive(start, end);
  const agrupado = {};
  const useDailyBuckets = diffDays <= 31;

  if (useDailyBuckets) {
    eachDayInRange(start, end).forEach((day) => {
      agrupado[day] = { label: day, ingresos: 0, consultas: 0 };
    });
  }

  facturasPagadas.forEach((f) => {
    const key = useDailyBuckets ? f.fecha : f.fecha.substring(0, 7);
    if (!agrupado[key]) agrupado[key] = { label: key, ingresos: 0, consultas: 0 };
    agrupado[key].consultas += 1;
    agrupado[key].ingresos += Number(f.total);
  });
  const serieTemporal = Object.values(agrupado).sort((a, b) => a.label.localeCompare(b.label));

  const freq = {};
  rows.forEach((c) => {
    if (!freq[c.paciente]) freq[c.paciente] = { count: 0, fechas: [], especie: c.especie };
    freq[c.paciente].count += 1;
    freq[c.paciente].fechas.push(parseLocalDate(c.fecha));
  });

  const recurrentes = Object.entries(freq)
    .filter(([, v]) => v.count > 1)
    .map(([nombre, p]) => {
      const sorted = p.fechas.sort((a, b) => a - b);
      const span = (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60 * 24);
      const tendencia = span > 0 ? Math.round(span / (p.count - 1)) : 0;
      return { nombre, count: p.count, tendencia, especie: p.especie };
    })
    .sort((a, b) => b.count - a.count);

  const conteoProductos = {};
  rows.forEach((c) => {
    const producto = estimateProductForService(c.servicio);
    if (producto) conteoProductos[producto] = (conteoProductos[producto] || 0) + 1;
  });

  const inventario = db.prepare('SELECT * FROM inventario').all();
  const alertasStock = [];
  const productosConsumidos = [];
  const alertasCorrelacion = [];
  Object.entries(conteoProductos).forEach(([producto, consumo]) => {
    const inv = inventario.find((i) => i.producto === producto);
    if (!inv) return;
    const minimoDinamico = Math.ceil(consumo * 1.2);
    productosConsumidos.push({
      name: inv.producto,
      consumo,
      stockReal: inv.stock,
      minimoDB: inv.minimo,
      minimoDinamico,
    });
    if (inv.stock < minimoDinamico) {
      alertasStock.push({
        producto,
        consumo,
        stock: inv.stock,
        minimoDinamico,
        minimoBase: inv.minimo,
      });
      alertasCorrelacion.push({
        name: inv.producto,
        stockReal: inv.stock,
        consumo,
        minimoDinamico,
      });
    }
  });
  productosConsumidos.sort((a, b) => b.consumo - a.consumo);

  const conteoMetodos = {};
  facturasPagadas.forEach((f) => {
    const mp = f.metodo_pago || 'Efectivo';
    conteoMetodos[mp] = (conteoMetodos[mp] || 0) + Number(f.total);
  });
  const metodosPago = Object.entries(conteoMetodos).map(([name, value]) => ({ name, value }));

  const topServicio = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0];

  const rowsIngresos = facturasPagadas.map((f) => ({
    fecha: f.fecha,
    paciente: f.paciente,
    especie: f.especie,
    servicio: f.servicio || 'Facturación',
    monto: f.total,
  }));

  return {
    rows,
    rowsIngresos,
    start,
    end,
    periodoLabel: fmtPeriod(start, end),
    emitido: new Date().toLocaleString('es-HN', { dateStyle: 'long', timeStyle: 'short' }),
    kpis: {
      totalIngresos,
      totalPendiente,
      totalConsultas: rows.length,
      completadas: completadas.length,
      pendientes: countPendientesVigentes(rows, start, end),
      canceladas: rows.filter((r) => r.estado === 'Cancelado').length,
      ticketPromedio,
      tasaCompletado,
      recurrentes: recurrentes.length,
    },
    tipos: Object.entries(tipos).map(([name, value]) => ({ name, value })),
    especies: Object.entries(especies).map(([name, value]) => ({ name, value })),
    serieTemporal,
    recurrentes,
    conteoProductos: Object.entries(conteoProductos)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    alertasStock,
    alertasCorrelacion,
    productosConsumidos,
    metodosPago,
    inventario,
    topServicio: topServicio ? { name: topServicio[0], count: topServicio[1] } : null,
  };
}

/** Respuesta JSON para la pantalla de Reportes (cliente). */
function buildClientAnalytics(db, start, end) {
  const a = buildAnalytics(db, start, end);
  return {
    kpis: {
      totalIngresos: a.kpis.totalIngresos,
      totalPendiente: a.kpis.totalPendiente,
      totalConsultas: a.kpis.totalConsultas,
      completadas: a.kpis.completadas,
      pendientes: a.kpis.pendientes,
    },
    ingresosYConsultas: a.serieTemporal.map((s) => ({
      name: s.label,
      Ingresos: s.ingresos,
      Facturas: s.consultas,
    })),
    consultasPorTipo: a.tipos,
    productosConsumidos: a.productosConsumidos,
    alertasCorrelacion: a.alertasCorrelacion,
    especies: a.especies,
    metodosPago: a.metodosPago,
    recurrentes: a.recurrentes.map((r) => ({
      count: r.count,
      tendencia: r.tendencia,
      data: { nombre: r.nombre, especie: r.especie },
    })),
  };
}

function fitImageBox(imgW, imgH, maxW, maxH) {
  const aspect = imgW / imgH;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

function addImageFit(doc, image, x, y, maxW, maxH) {
  const { width, height, buffer } = image;
  const { w, h } = fitImageBox(width, height, maxW, maxH);
  doc.addImage(buffer, 'PNG', x, y, w, h);
  return h;
}

async function renderChart(type, labels, datasets, options = {}) {
  if (!labels.length) return null;
  const width = options.width || 640;
  const height = options.height || 280;
  let ChartJSNodeCanvas;
  try {
    ({ ChartJSNodeCanvas } = require('chartjs-node-canvas'));
  } catch (err) {
    console.warn('chartjs-node-canvas no disponible:', err.message);
    return null;
  }
  let canvas;
  try {
    canvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff' });
  } catch (err) {
    console.warn('ChartJSNodeCanvas no disponible:', err.message);
    return null;
  }
  const config = {
    type,
    data: { labels, datasets },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: datasets.length > 1 || type === 'doughnut',
          position: 'bottom',
          labels: { font: { size: 11 }, padding: 14 },
        },
      },
      scales:
        type === 'doughnut'
          ? {}
          : {
              x: {
                grid: { display: false },
                ticks: { font: { size: 10 }, maxRotation: 45 },
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(148,163,184,0.25)' },
                ticks: { font: { size: 10 } },
              },
            },
      ...options.chartOptions,
    },
  };
  try {
    const buffer = await canvas.renderToBuffer(config);
    return { buffer, width, height };
  } catch (err) {
    console.warn('Error renderizando gráfico:', err.message);
    return null;
  }
}

async function buildChartImages(analytics) {
  const { serieTemporal, tipos, especies } = analytics;
  const images = {};

  try {
  if (serieTemporal.length > 0) {
    images.barras = await renderChart(
      'bar',
      serieTemporal.map((s) => s.label),
      [
        {
          label: 'Ingresos ($)',
          data: serieTemporal.map((s) => s.ingresos),
          backgroundColor: 'rgba(14, 165, 233, 0.85)',
          borderRadius: 6,
        },
        {
          label: 'Citas cobradas',
          data: serieTemporal.map((s) => s.consultas),
          backgroundColor: 'rgba(139, 92, 246, 0.85)',
          borderRadius: 6,
        },
      ],
      { width: 700, height: 340 }
    );

    images.lineas = await renderChart(
      'line',
      serieTemporal.map((s) => s.label),
      [
        {
          label: 'Ingresos',
          data: serieTemporal.map((s) => s.ingresos),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        },
      ],
      { width: 700, height: 320 }
    );
  }

  if (tipos.length > 0) {
    images.pastel = await renderChart(
      'doughnut',
      tipos.map((t) => t.name),
      [
        {
          data: tipos.map((t) => t.value),
          backgroundColor: CHART_COLORS.slice(0, tipos.length),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
      { width: 380, height: 380, chartOptions: { cutout: '58%' } }
    );
  }

  if (especies.length > 0) {
    images.especies = await renderChart(
      'bar',
      especies.map((e) => e.name),
      [
        {
          label: 'Atenciones',
          data: especies.map((e) => e.value),
          backgroundColor: 'rgba(34, 197, 94, 0.85)',
          borderRadius: 6,
        },
      ],
      {
        width: 520,
        height: Math.max(280, especies.length * 48),
        chartOptions: { indexAxis: 'y' },
      }
    );
  }
  } catch (err) {
    console.warn('Gráficos omitidos en PDF:', err.message);
  }

  return images;
}

function drawHeader(doc, analytics, pageNum) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, w, 42, 'F');
  doc.setFillColor(...BRAND.primaryDark);
  doc.rect(0, 38, w, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('VET-MIS', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Informe ejecutivo de operaciones', 14, 26);

  doc.setFontSize(9);
  doc.text(analytics.periodoLabel, w - 14, 16, { align: 'right' });
  doc.text(`Emitido: ${analytics.emitido}`, w - 14, 24, { align: 'right' });
  if (pageNum) {
    doc.setFontSize(8);
    doc.text(`Pág. ${pageNum}`, w - 14, 32, { align: 'right' });
  }
  doc.setTextColor(...BRAND.slate);
}

function drawKpiCards(doc, analytics, startY) {
  const w = doc.internal.pageSize.getWidth();
  const cards = [
    { label: 'Ingresos', value: fmtMoney(analytics.kpis.totalIngresos), color: BRAND.success },
    { label: 'Consultas', value: String(analytics.kpis.totalConsultas), color: BRAND.accent },
    { label: 'Completadas', value: String(analytics.kpis.completadas), color: BRAND.violet },
    { label: 'Ticket prom.', value: fmtMoney(analytics.kpis.ticketPromedio), color: BRAND.amber },
    { label: 'Tasa cierre', value: `${analytics.kpis.tasaCompletado.toFixed(0)}%`, color: BRAND.primary },
    { label: 'Recurrentes', value: String(analytics.kpis.recurrentes), color: BRAND.danger },
  ];

  const gap = 4;
  const cardW = (w - 28 - gap * (cards.length - 1)) / cards.length;
  let x = 14;

  cards.forEach((card) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...card.color);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, startY, cardW, 28, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...card.color);
    const valLines = doc.splitTextToSize(card.value, cardW - 6);
    doc.text(valLines[0], x + cardW / 2, startY + 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.muted);
    doc.text(card.label.toUpperCase(), x + cardW / 2, startY + 23, { align: 'center' });
    x += cardW + gap;
  });

  return startY + 36;
}

function drawSectionTitle(doc, title, y) {
  doc.setFillColor(...BRAND.light);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.primaryDark);
  doc.text(title.toUpperCase(), 18, y + 7);
  return y + 14;
}

function addInsightBox(doc, y, lines) {
  const w = doc.internal.pageSize.getWidth() - 28;
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.3);
  const boxH = 8 + lines.length * 5;
  doc.roundedRect(14, y, w, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND.slate);
  lines.forEach((line, i) => doc.text(line, 18, y + 6 + i * 5));
  return y + boxH + 6;
}

async function generatePdfBuffer(db, start, end) {
  const analytics = buildAnalytics(db, start, end);
  const charts = await buildChartImages(analytics);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 28;

  drawHeader(doc, analytics);
  let y = 52;
  y = drawKpiCards(doc, analytics, y);

  const insights = [];
  if (analytics.topServicio) {
    insights.push(
      `• Servicio líder: ${analytics.topServicio.name} (${analytics.topServicio.count} citas en el periodo).`
    );
  }
  insights.push(
    `• ${analytics.kpis.pendientes} cita(s) pendiente(s) y ${analytics.kpis.completadas} completada(s).`
  );
  if (analytics.alertasStock.length > 0) {
    insights.push(
      `• ${analytics.alertasStock.length} producto(s) con riesgo de desabasto según consumo del periodo.`
    );
  } else {
    insights.push('• Inventario alineado con el consumo registrado en el periodo.');
  }
  y = addInsightBox(doc, y, insights);

  if (charts.barras) {
    y = drawSectionTitle(doc, 'Ingresos cobrados por periodo', y);
    const barrasH = addImageFit(doc, charts.barras, 14, y, contentW, 72);
    y += barrasH + 8;
  }

  if (y > pageH - 90 && charts.pastel) {
    doc.addPage();
    drawHeader(doc, analytics, doc.getNumberOfPages());
    y = 52;
  }

  if (charts.pastel || charts.especies) {
    y = drawSectionTitle(doc, 'Distribución operativa', y);
    const gap = 6;
    const half = (contentW - gap) / 2;
    const maxRowH = 78;
    let rowH = 0;

    if (charts.pastel) {
      const { w, h } = fitImageBox(charts.pastel.width, charts.pastel.height, half, maxRowH);
      doc.addImage(charts.pastel.buffer, 'PNG', 14 + (half - w) / 2, y, w, h);
      rowH = Math.max(rowH, h);
    }
    if (charts.especies) {
      const { w, h } = fitImageBox(charts.especies.width, charts.especies.height, half, maxRowH);
      doc.addImage(charts.especies.buffer, 'PNG', 14 + half + gap + (half - w) / 2, y, w, h);
      rowH = Math.max(rowH, h);
    }
    y += rowH + 8;
  }

  if (charts.lineas) {
    if (y > pageH - 70) {
      doc.addPage();
      drawHeader(doc, analytics, doc.getNumberOfPages());
      y = 52;
    }
    y = drawSectionTitle(doc, 'Evolución de ingresos', y);
    const lineasH = addImageFit(doc, charts.lineas, 14, y, contentW, 65);
    y += lineasH + 8;
  }

  if (analytics.recurrentes.length > 0 || analytics.conteoProductos.length > 0) {
    if (y > pageH - 60) {
      doc.addPage();
      drawHeader(doc, analytics, doc.getNumberOfPages());
      y = 52;
    }
    y = drawSectionTitle(doc, 'Fidelización e insumos', y);

    if (analytics.recurrentes.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Paciente', 'Visitas', 'Frecuencia estimada', 'Especie']],
        body: analytics.recurrentes.slice(0, 8).map((r) => [
          r.nombre,
          r.count,
          r.tendencia === 0 ? 'Visitas consecutivas' : `Cada ~${r.tendencia} días`,
          r.especie,
        ]),
        theme: 'grid',
        headStyles: { fillColor: BRAND.violet, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    if (analytics.conteoProductos.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Producto / insumo', 'Unidades estimadas']],
        body: analytics.conteoProductos.map((p) => [p.name, p.value]),
        theme: 'striped',
        headStyles: { fillColor: BRAND.accent, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  if (analytics.alertasStock.length > 0) {
    if (y > pageH - 50) {
      doc.addPage();
      drawHeader(doc, analytics, doc.getNumberOfPages());
      y = 52;
    }
    y = drawSectionTitle(doc, 'Alertas de inventario', y);
    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Producto', 'Consumo periodo', 'Stock actual', 'Mín. sugerido']],
      body: analytics.alertasStock.map((a) => [
        a.producto,
        a.consumo,
        a.stock,
        a.minimoDinamico,
      ]),
      theme: 'grid',
      headStyles: { fillColor: BRAND.danger, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  doc.addPage();
  drawHeader(doc, analytics, doc.getNumberOfPages());
  y = 52;
  y = drawSectionTitle(doc, 'Registro de ingresos', y);

  const tableRows = analytics.rowsIngresos.map((r) => [
    fmtDate(r.fecha),
    r.paciente,
    r.especie,
    r.servicio,
    fmtMoney(Number(r.monto)),
  ]);

  doc.autoTable({
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Fecha', 'Paciente', 'Especie', 'Servicio', 'Monto']],
    body:
      tableRows.length > 0
        ? tableRows
        : [['—', 'Sin ingresos cobrados en el periodo', '', '', '']],
    foot: [['', '', '', 'TOTAL', fmtMoney(analytics.kpis.totalIngresos)]],
    theme: 'striped',
    headStyles: { fillColor: BRAND.primary, fontSize: 8 },
    footStyles: { fillColor: BRAND.primaryDark, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { halign: 'right' },
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `VET-MIS · Documento confidencial · ${analytics.periodoLabel}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function styleHeaderRow(row, colorArgb) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 24;
}

async function generateExcelBuffer(db, start, end) {
  const analytics = buildAnalytics(db, start, end);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VET-MIS';
  wb.created = new Date();
  wb.properties.date1904 = false;

  const brandFill = 'FF0F766E';
  const brandDark = 'FF0D5D58';

  // ── Hoja Resumen ──
  const wsResumen = wb.addWorksheet('Resumen', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }],
  });
  wsResumen.mergeCells('A1:F1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'VET-MIS — Informe ejecutivo';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandFill } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 36;

  wsResumen.mergeCells('A2:F2');
  wsResumen.getCell('A2').value = `Periodo: ${analytics.periodoLabel}  ·  Generado: ${analytics.emitido}`;
  wsResumen.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
  wsResumen.getCell('A2').alignment = { horizontal: 'center' };

  wsResumen.addRow([]);
  const kpiData = [
    ['Indicador', 'Valor', '', 'Indicador', 'Valor'],
    ['Ingresos totales', analytics.kpis.totalIngresos, '', 'Consultas totales', analytics.kpis.totalConsultas],
    ['Completadas', analytics.kpis.completadas, '', 'Pendientes', analytics.kpis.pendientes],
    ['Ticket promedio', analytics.kpis.ticketPromedio, '', 'Tasa de cierre', analytics.kpis.tasaCompletado / 100],
    ['Pacientes recurrentes', analytics.kpis.recurrentes, '', 'Servicio líder', analytics.topServicio?.name || '—'],
  ];
  kpiData.forEach((r) => wsResumen.addRow(r));
  wsResumen.getRow(4).font = { bold: true };
  [5, 6, 7, 8].forEach((rn) => {
    const row = wsResumen.getRow(rn);
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
    row.getCell(2).font = { bold: true };
    row.getCell(5).font = { bold: true };
  });
  wsResumen.getCell('B5').numFmt = '$#,##0.00';
  wsResumen.getCell('B8').numFmt = '$#,##0.00';
  wsResumen.getCell('E8').numFmt = '0.0%';

  wsResumen.addRow([]);
  wsResumen.addRow(['Distribución por servicio']);
  wsResumen.lastRow.font = { bold: true, size: 12, color: { argb: brandDark } };
  const hdrTipos = wsResumen.addRow(['Servicio', 'Cantidad', '% del total']);
  styleHeaderRow(hdrTipos, brandFill);
  const totalTipos = analytics.tipos.reduce((s, t) => s + t.value, 0) || 1;
  analytics.tipos.forEach((t, idx) => {
    const row = wsResumen.addRow([t.name, t.value, t.value / totalTipos]);
    row.getCell(3).numFmt = '0.0%';
    if (idx % 2 === 0) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  if (analytics.alertasStock.length > 0) {
    wsResumen.addRow([]);
    wsResumen.addRow(['⚠ Alertas de inventario']);
    wsResumen.lastRow.font = { bold: true, color: { argb: 'FFB45309' } };
    const hdrAlert = wsResumen.addRow(['Producto', 'Consumo', 'Stock', 'Mín. sugerido']);
    styleHeaderRow(hdrAlert, 'FFDC2626');
    analytics.alertasStock.forEach((a) => {
      wsResumen.addRow([a.producto, a.consumo, a.stock, a.minimoDinamico]);
    });
  }

  wsResumen.columns = [
    { width: 22 },
    { width: 18 },
    { width: 12 },
    { width: 22 },
    { width: 18 },
    { width: 12 },
  ];

  // ── Hoja Registro de ingresos (solo citas completadas / cobradas) ──
  const wsIngresos = wb.addWorksheet('Ingresos', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  wsIngresos.mergeCells('A1:E1');
  wsIngresos.getCell('A1').value = `Registro de ingresos · ${analytics.periodoLabel}`;
  styleHeaderRow(wsIngresos.getRow(1), brandFill);
  wsIngresos.getRow(1).getCell(1).alignment = { horizontal: 'left', indent: 1 };

  const hdrIngresos = wsIngresos.addRow(['Fecha', 'Paciente', 'Especie', 'Servicio', 'Monto']);
  styleHeaderRow(hdrIngresos, 'FF2563EB');
  analytics.rowsIngresos.forEach((r, idx) => {
    const row = wsIngresos.addRow([
      r.fecha,
      r.paciente,
      r.especie,
      r.servicio,
      Number(r.monto),
    ]);
    row.getCell(5).numFmt = '$#,##0.00';
    if (idx % 2 === 0) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
    row.getCell(5).font = { color: { argb: 'FF166534' }, bold: true };
  });
  const totRow = wsIngresos.addRow(['', '', '', 'TOTAL', analytics.kpis.totalIngresos]);
  totRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandDark } };
  totRow.getCell(5).numFmt = '$#,##0.00';
  if (analytics.rowsIngresos.length > 0) {
    wsIngresos.autoFilter = { from: 'A2', to: `E${wsIngresos.rowCount - 1}` };
  }
  wsIngresos.columns = [
    { width: 14 },
    { width: 24 },
    { width: 14 },
    { width: 26 },
    { width: 14 },
  ];

  // ── Hoja Recurrentes ──
  const wsRec = wb.addWorksheet('Fidelización');
  wsRec.mergeCells('A1:D1');
  wsRec.getCell('A1').value = 'Pacientes recurrentes';
  styleHeaderRow(wsRec.getRow(1), 'FF7C3AED');
  const hdrRec = wsRec.addRow(['Paciente', 'Visitas', 'Frecuencia', 'Especie']);
  styleHeaderRow(hdrRec, 'FF6D28D9');
  if (analytics.recurrentes.length === 0) {
    wsRec.addRow(['Sin recurrencia en el periodo', '', '', '']);
  } else {
    analytics.recurrentes.forEach((r, idx) => {
      const row = wsRec.addRow([
        r.nombre,
        r.count,
        r.tendencia === 0 ? 'Visitas consecutivas' : `Cada ~${r.tendencia} días`,
        r.especie,
      ]);
      if (idx % 2 === 0) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        });
      }
    });
  }
  wsRec.columns = [{ width: 28 }, { width: 12 }, { width: 22 }, { width: 14 }];

  // ── Hoja Inventario ──
  const wsInv = wb.addWorksheet('Inventario');
  wsInv.mergeCells('A1:E1');
  wsInv.getCell('A1').value = 'Estado de inventario (referencia al cierre del reporte)';
  styleHeaderRow(wsInv.getRow(1), brandFill);
  const hdrInv = wsInv.addRow(['Producto', 'Stock', 'Mínimo', 'Categoría', 'Estado']);
  styleHeaderRow(hdrInv, 'FF0891B2');
  analytics.inventario.forEach((item, idx) => {
    const bajo = item.stock <= item.minimo;
    const row = wsInv.addRow([
      item.producto,
      item.stock,
      item.minimo,
      item.categoria,
      bajo ? '⚠ Bajo' : 'OK',
    ]);
    if (bajo) {
      row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
      });
    } else if (idx % 2 === 0) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });
  wsInv.columns = [{ width: 32 }, { width: 10 }, { width: 10 }, { width: 16 }, { width: 12 }];

  return wb.xlsx.writeBuffer();
}

async function generateInvoicePdfBuffer(db, invoiceId) {
  const invoice = db.prepare(`
    SELECT f.*, p.nombre as paciente, p.especie, p.raza, cl.nombre as dueno, cl.telefono, cl.email, c.servicio
    FROM facturas f
    JOIN pacientes p ON f.paciente_id = p.id
    JOIN clientes cl ON f.cliente_id = cl.id
    LEFT JOIN citas c ON f.cita_id = c.id
    WHERE f.id = ?
  `).get(invoiceId);

  if (!invoice) throw new Error('Factura no encontrada');

  const historial = db.prepare(`
    SELECT tratamiento 
    FROM historial_medico 
    WHERE paciente_id = ? AND fecha = ?
    ORDER BY id DESC LIMIT 1
  `).get(invoice.paciente_id, invoice.fecha);

  const medicamentosProvistos = historial && historial.tratamiento 
    ? historial.tratamiento 
    : (invoice.servicio ? estimateProductForService(invoice.servicio) : null);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Header banner
  doc.setFillColor(15, 118, 110); // primary
  doc.rect(0, 0, w, 35, 'F');
  doc.setFillColor(13, 94, 88); // primary dark
  doc.rect(0, 32, w, 3, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('VET-MIS', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Clínica Veterinaria & Sistema Gerencial', 14, 25);

  // Invoice label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const facNum = `FACTURA RECIBO: FAC-${String(invoice.id).padStart(5, '0')}`;
  doc.text(facNum, w - 14, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Fecha: ${invoice.fecha}`, w - 14, 25, { align: 'right' });

  // Reset text color
  doc.setTextColor(30, 41, 59);

  // Client and Pet Info Cards
  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, (w - 32) / 2, 34, 3, 3, 'FD');
  doc.roundedRect(14 + (w - 32) / 2 + 4, y, (w - 32) / 2, 34, 3, 3, 'FD');

  // Client card text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DATOS DEL PROPIETARIO', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nombre: ${invoice.dueno}`, 18, y + 14);
  doc.text(`Teléfono: ${invoice.telefono || '—'}`, 18, y + 21);
  doc.text(`Email: ${invoice.email || '—'}`, 18, y + 28);

  // Pet card text
  const px = 14 + (w - 32) / 2 + 8;
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DE LA MASCOTA', px, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Paciente: ${invoice.paciente}`, px, y + 14);
  doc.text(`Especie: ${invoice.especie}`, px, y + 21);
  doc.text(`Raza: ${invoice.raza || '—'}`, px, y + 28);

  y += 42;

  // Table of Items
  doc.autoTable({
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Descripción del concepto', 'Cant.', 'Precio Unitario', 'Total']],
    body: [
      [
        invoice.servicio || 'Servicios Veterinarios / Consulta General',
        '1',
        `$${Number(invoice.total).toFixed(2)}`,
        `$${Number(invoice.total).toFixed(2)}`
      ],
      medicamentosProvistos ? [
        `Medicamentos / Tratamiento provisto:\n${medicamentosProvistos}`,
        '—',
        '—',
        '—'
      ] : null
    ].filter(Boolean),
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Totals and Payment Method
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Método de Pago: ${invoice.metodo_pago || '—'}`, 14, y + 6);
  
  const statusColor = invoice.estado === 'Pagada' ? [16, 185, 129] : [239, 68, 68];
  doc.setFont('helvetica', 'bold');
  doc.text('Estado: ', 14, y + 13);
  doc.setTextColor(...statusColor);
  doc.text((invoice.estado || 'PENDIENTE').toUpperCase(), 29, y + 13);
  doc.setTextColor(30, 41, 59);

  // Subtotal & Tax box
  const tx = w - 75;
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', tx, y + 6);
  doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, w - 14, y + 6, { align: 'right' });
  doc.text('IVA (16%):', tx, y + 13);
  doc.text(`$${Number(invoice.impuesto).toFixed(2)}`, w - 14, y + 13, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(tx, y + 17, w - 14, y + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', tx, y + 24);
  doc.setTextColor(15, 118, 110);
  doc.text(`$${Number(invoice.total).toFixed(2)}`, w - 14, y + 24, { align: 'right' });

  // Footer
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('¡Gracias por confiar en VET-MIS para el cuidado de tu mascota!', w / 2, h - 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Este documento es un comprobante de pago simplificado emitido por el sistema VET-MIS.', w / 2, h - 14, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = {
  buildAnalytics,
  buildClientAnalytics,
  generatePdfBuffer,
  generateExcelBuffer,
  generateInvoicePdfBuffer,
};
