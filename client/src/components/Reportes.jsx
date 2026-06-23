import { useState, useEffect } from 'react';
import { FileText, Table, CheckCircle, AlertCircle, AlertTriangle, Users, DollarSign, Activity, Loader2, CreditCard } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { getInvoices, getAppointments, getInventory, getPatients } from '../services/db';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];

const PRESETS = [
  { label: 'Esta semana', type: 'semana_actual' },
  { label: 'Este mes', type: 'mes_actual' },
  { label: 'Último trimestre', type: 'trimestre' },
  { label: 'Este año', type: 'año' },
];

const getLocalStr = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtLPS = (n) => `L ${Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Reportes() {
  const todayStr = getLocalStr();
  const dStart = new Date();
  const defaultStart = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, '0')}-01`;
  
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(todayStr);
  const [downloading, setDownloading] = useState(null);
  const [result, setResult] = useState(null);
  
  const [data, setData] = useState({
    kpis: { totalIngresos: 0, totalConsultas: 0, completadas: 0, pendientes: 0, totalPendiente: 0 },
    ingresosYConsultas: [],
    consultasPorTipo: [],
    productosConsumidos: [],
    alertasCorrelacion: [],
    especies: [],
    recurrentes: [],
    metodosPago: []
  });
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarAnaliticas();
  }, [start, end]);

  const cargarAnaliticas = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [invoices, appointments, inventory, patients] = await Promise.all([
        getInvoices(), getAppointments(), getInventory(), getPatients()
      ]);

      const inRange = (fecha) => fecha >= start && fecha <= end;
      const validInvoices = invoices.filter(i => inRange(i.fecha));
      const validAppointments = appointments.filter(a => inRange(a.fecha));

      let totalIngresos = 0;
      let totalPendiente = 0;
      const metodosMap = {};

      validInvoices.forEach(inv => {
        if (inv.estado === 'Pagada') {
          totalIngresos += Number(inv.total) || 0;
          const mp = inv.metodo_pago || 'Desconocido';
          metodosMap[mp] = (metodosMap[mp] || 0) + (Number(inv.total) || 0);
        } else if (inv.estado === 'Pendiente') {
          totalPendiente += Number(inv.total) || 0;
        }
      });

      const metodosPago = Object.entries(metodosMap).map(([name, value]) => ({ name, value }));

      let completadas = 0;
      let pendientes = 0;
      const consultasMap = {};

      validAppointments.forEach(app => {
        if (app.estado === 'Completado') completadas++;
        else if (app.estado === 'Pendiente' || app.estado === 'En Proceso') pendientes++;
        
        const s = app.servicio || 'General';
        consultasMap[s] = (consultasMap[s] || 0) + 1;
      });

      const consultasPorTipo = Object.entries(consultasMap).map(([name, value]) => ({ name, value }));

      const startD = new Date(start);
      const endD = new Date(end);
      const diffDays = (endD - startD) / (1000 * 60 * 60 * 24);
      
      const timeGroup = {};
      validInvoices.forEach(inv => {
        if (inv.estado === 'Pagada') {
          let key = inv.fecha;
          if (diffDays > 31) key = key.substring(0, 7);
          
          if (!timeGroup[key]) timeGroup[key] = { Ingresos: 0, Facturas: 0 };
          timeGroup[key].Ingresos += Number(inv.total) || 0;
          timeGroup[key].Facturas += 1;
        }
      });

      const ingresosYConsultas = Object.keys(timeGroup).sort().map(key => ({
        name: key,
        Ingresos: timeGroup[key].Ingresos,
        Facturas: timeGroup[key].Facturas
      }));

      const pacientesMap = {};
      patients.forEach(p => { pacientesMap[p.id] = p; });

      const especiesMap = {};
      const patientVisits = {};

      validAppointments.forEach(app => {
        const pid = app.paciente_id;
        const p = pacientesMap[pid];
        if (p) {
          const esp = p.especie || 'Desconocido';
          especiesMap[esp] = (especiesMap[esp] || 0) + 1;
        }
        if (app.estado === 'Completado') {
           patientVisits[pid] = (patientVisits[pid] || 0) + 1;
        }
      });

      const especies = Object.entries(especiesMap).map(([name, value]) => ({ name, value }));
      
      const recurrentes = Object.entries(patientVisits)
        .filter(([id, count]) => count > 1)
        .map(([id, count]) => ({
          data: { nombre: pacientesMap[id]?.nombre || 'Desconocido' },
          count,
          tendencia: Math.round(diffDays / count) || 1
        }))
        .sort((a,b) => b.count - a.count)
        .slice(0, 5);

      const productosConsumidos = inventory.map(item => ({
        name: item.nombre,
        consumo: 0,
        stockReal: Number(item.stock),
        minimoDB: Number(item.minimo),
        minimoDinamico: Number(item.minimo)
      })).filter(i => i.stockReal <= i.minimoDB);

      const alertasCorrelacion = productosConsumidos.filter(p => p.stockReal <= 0);

      setData({
        kpis: { 
          totalIngresos, 
          totalConsultas: validAppointments.length, 
          completadas, 
          pendientes, 
          totalPendiente 
        },
        ingresosYConsultas,
        consultasPorTipo,
        productosConsumidos,
        alertasCorrelacion,
        especies,
        recurrentes,
        metodosPago,
      });

    } catch (e) {
      console.error(e);
      setLoadError(e.message || 'No se pudo cargar la analítica');
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (type) => {
    const d = new Date();
    if (type === 'mes_actual') {
      setStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    } else if (type === 'semana_actual') {
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff = monday.getDay() === 0 ? 6 : monday.getDay() - 1;
      monday.setDate(monday.getDate() - diff);
      setStart(getLocalStr(monday));
    } else if (type === 'trimestre') {
      d.setMonth(d.getMonth() - 3);
      setStart(getLocalStr(d));
    } else if (type === 'año') {
      setStart(`${d.getFullYear()}-01-01`);
    }
    setEnd(todayStr);
  };

  const download = async (type) => {
    setDownloading(type);
    setResult(null);
    try {
      if (type === 'pdf') {
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Reporte VET-MIS", 14, 22);
        doc.setFontSize(11);
        doc.text(`Periodo: ${start} a ${end}`, 14, 30);
        
        doc.autoTable({
          startY: 40,
          head: [['Métrica', 'Valor']],
          body: [
            ['Total Ingresos (Cobrados)', fmtLPS(data.kpis.totalIngresos)],
            ['Cuentas por Cobrar (Pendiente)', fmtLPS(data.kpis.totalPendiente)],
            ['Citas Completadas', data.kpis.completadas],
            ['Citas Pendientes', data.kpis.pendientes],
            ['Total de Citas Programadas', data.kpis.totalConsultas],
          ]
        });

        doc.save(`reporte_${start}_${end}.pdf`);
        setResult({ ok: true, msg: 'PDF descargado correctamente.' });
      } else {
        const { utils, writeFile } = await import('xlsx');
        
        const wb = utils.book_new();
        const wsKpi = utils.json_to_sheet([
          { Metrica: 'Total Ingresos', Valor: data.kpis.totalIngresos },
          { Metrica: 'Cuentas por Cobrar', Valor: data.kpis.totalPendiente },
          { Metrica: 'Citas Completadas', Valor: data.kpis.completadas },
          { Metrica: 'Citas Pendientes', Valor: data.kpis.pendientes },
          { Metrica: 'Total Citas Programadas', Valor: data.kpis.totalConsultas },
        ]);
        utils.book_append_sheet(wb, wsKpi, "KPIs");

        const wsIngresos = utils.json_to_sheet(data.ingresosYConsultas);
        utils.book_append_sheet(wb, wsIngresos, "Ingresos");

        writeFile(wb, `reporte_${start}_${end}.xlsx`);
        setResult({ ok: true, msg: 'Excel descargado correctamente.' });
      }
    } catch (e) {
      console.error(e);
      setResult({ ok: false, msg: 'No se pudo generar el archivo' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      
      {loadError && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
          <p style={{ margin: 0, color: '#ef4444', fontSize: '0.9rem' }}>
            <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {loadError}
          </p>
        </div>
      )}

      <div style={{ height: '24px', marginBottom: '1rem' }} />

      {/* Controles Top */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Exportar informes
          </p>
        </div>
        
        <div style={{ flex: 1, display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Inicio</label>
            <input type="date" className="form-input" style={{ padding: '0.5rem' }} value={start} onChange={e => setStart(e.target.value)} max={end}/>
          </div>
          <div>
            <label className="form-label">Fin</label>
            <input type="date" className="form-input" style={{ padding: '0.5rem' }} value={end} onChange={e => setEnd(e.target.value)} min={start} max={todayStr}/>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '4px' }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => setPreset(p.type)} className="btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>{p.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', paddingBottom: '4px' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => download('excel')}
              disabled={!!downloading}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '0.55rem 1.1rem', minWidth: 120 }}
            >
              {downloading === 'excel' ? <Loader2 size={16} className="spin" /> : <Table size={16} />}
              {downloading === 'excel' ? 'Generando…' : 'Excel'}
            </button>
            <button
              onClick={() => download('pdf')}
              disabled={!!downloading}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)', padding: '0.55rem 1.1rem', minWidth: 120 }}
            >
              {downloading === 'pdf' ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
              {downloading === 'pdf' ? 'Generando…' : 'PDF'}
            </button>
          </div>
          {result && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: result.ok ? '#10b981' : '#ef4444', maxWidth: 280, textAlign: 'right' }}>
              {result.msg}
            </p>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'grid', placeItems: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>L {data.kpis.totalIngresos.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Ingresos Reales (Cobrado)</p>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'grid', placeItems: 'center' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>L {data.kpis.totalPendiente.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Cuentas por Cobrar (Pendiente)</p>
          </div>
        </div>
        
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', display: 'grid', placeItems: 'center' }}>
            <Activity size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{data.kpis.totalConsultas}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Citas Programadas</p>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'grid', placeItems: 'center' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{data.kpis.completadas}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Citas Completadas</p>
          </div>
        </div>
      </div>

      {/* Row 1: Ingresos Contables vs Consultas por Tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Ingresos por Periodo (L Cobrado)</h3>
          <div id="chart-barras" style={{ height: '240px' }}>
            {data.ingresosYConsultas.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ingresosYConsultas} margin={{ left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} />
                <RechartsTooltip contentStyle={{ background: 'var(--glass)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} />
                <Legend wrapperStyle={{ color: 'var(--text-main)', fontSize: '11px' }}/>
                <Bar yAxisId="left" dataKey="Ingresos" name="Ingresos ($)" fill="#10b981" radius={[4,4,0,0]} />
                <Bar yAxisId="right" dataKey="Facturas" name="Facturas cobradas" fill="#8b5cf6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '4rem' }}>Sin ingresos cobrados en este periodo.</p>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Consultas por Servicio (Demanda)</h3>
          <div id="chart-pastel" style={{ height: '260px' }}>
            {data.consultasPorTipo.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.consultasPorTipo} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                  {data.consultasPorTipo.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ background: 'var(--glass)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} itemStyle={{ color: 'var(--text-main)' }} />
                <Legend verticalAlign="bottom" wrapperStyle={{ color: 'var(--text-main)', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '4rem' }}>Sin citas en este periodo.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Especies vs Medios de Pago */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Pacientes por Especie</h3>
          <div style={{ height: '200px' }}>
            {data.especies.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data.especies} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-main)', fontSize: 11}} />
                <RechartsTooltip contentStyle={{ background: 'var(--glass)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0,4,4,0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '3rem' }}>Sin datos de especies.</p>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Rendimiento por Método de Pago</h3>
          <div style={{ height: '200px' }}>
            {data.metodosPago.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.metodosPago} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                  {data.metodosPago.map((entry, index) => <Cell key={index} fill={COLORS[(index + 2) % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip formatter={(val) => `$${Number(val).toFixed(2)}`} contentStyle={{ background: 'var(--glass)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} />
                <Legend verticalAlign="bottom" wrapperStyle={{ color: 'var(--text-main)', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '3rem' }}>Sin ingresos cobrados en este periodo.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Consumo de Insumos */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Consumo Estimado de Medicamentos/Insumos (Demanda en Citas)</h3>
        <div style={{ height: '220px' }}>
          {data.productosConsumidos.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data.productosConsumidos} margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-main)', fontSize: 11}} width={120} />
              <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: 'var(--glass)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} />
              <Bar dataKey="consumo" name="Consumo (unidades)" fill="#0ea5e9" radius={[0,4,4,0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '4rem' }}>Sin consumo estimado en este periodo.</p>
          )}
        </div>

        {/* Alertas Predictivas */}
        {data.alertasCorrelacion.length > 0 && (
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '1.25rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: '700', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              <AlertTriangle size={18} /> Alerta Contable/Operativa: Riesgo de rotura de stock
            </div>
            {data.alertasCorrelacion.map((alerta, i) => (
              <p key={i} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
                <b>{alerta.name}:</b> Basado en el consumo reciente ({alerta.consumo} uds), el <b>mínimo sugerido dinámico</b> es {alerta.minimoDinamico}. Tu stock actual de <b style={{ color: '#ef4444' }}>{alerta.stockReal}</b> es insuficiente.
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Row 4: Listas Inferiores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <Users size={18} color="#8b5cf6" /> Pacientes Recurrentes
          </h3>
          {data.recurrentes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.recurrentes.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0, color: 'var(--text-main)' }}>{p.data.nombre}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Frecuencia: {p.tendencia === 0 ? 'Días seguidos' : `Viene cada ~${p.tendencia} días`}</p>
                  </div>
                  <div className="badge badge-info">{p.count} Visitas</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Sin recurrencia en este periodo.</p>
          )}
        </div>

        {data.productosConsumidos.filter(p => p.stockReal <= p.minimoDB).length > 0 && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Stock Bajo Actual</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.productosConsumidos.filter(p => p.stockReal <= p.minimoDB).slice(0,4).map((item, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>{item.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><b style={{color: '#ef4444'}}>{item.stockReal}</b> / {item.minimoDB} mín. base</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${Math.min((item.stockReal / item.minimoDB) * 100, 100)}%`, background: '#ef4444', borderRadius: '3px' }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
