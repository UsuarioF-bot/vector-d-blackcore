import { useState, useEffect } from 'react';
import { Stethoscope, ClipboardList, DollarSign, AlertTriangle, Activity, CalendarClock, Beaker, FileBarChart, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAppointments, getInventory, getPatients, getInvoices } from '../services/db';

export default function Dashboard({ setTab, userRole }) {
  const [data, setData] = useState({ kpis: null, chart: [], agenda: [], totalPacientes: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [citas, inventario, pacientes, facturas] = await Promise.all([
        getAppointments(),
        getInventory(),
        getPatients(),
        getInvoices() // Simularemos stats e ingresos mes usando las facturas reales
      ]);

      const dateToLocalStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const today = new Date();
      const todayStr = dateToLocalStr(today);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const nextWeekStr = dateToLocalStr(nextWeek);
      
      // KPIs
      const citasHoy = citas.filter(c => c.fecha === todayStr).length;
      
      // Semana actual (Lunes a Domingo)
      const startOfWeek = new Date(today);
      const diff = startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startOfWeekStr = dateToLocalStr(startOfWeek);
      const endOfWeekStr = dateToLocalStr(endOfWeek);
      
      const citasSemana = citas.filter(c => c.fecha >= startOfWeekStr && c.fecha <= endOfWeekStr).length;

      const stockBajo = inventario.filter(i => i.stock <= i.minimo).length;
      
      // Ingresos Mes actual
      const currentMonth = todayStr.substring(0, 7); // "YYYY-MM"
      const ingresosMes = facturas
        .filter(f => f.estado === 'Pagada' && f.fecha && f.fecha.startsWith(currentMonth))
        .reduce((sum, f) => sum + (Number(f.total) || 0), 0);

      // Gráfico Lineal: Últimos 7 Días agrupando facturas
      const diasStr = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dStr = dateToLocalStr(d);
        const ingresosDia = facturas
          .filter(f => f.estado === 'Pagada' && f.fecha === dStr)
          .reduce((sum, f) => sum + (Number(f.total) || 0), 0);
          
        last7Days.push({
          name: diasStr[d.getDay()],
          fechaStr: dStr,
          total: ingresosDia
        });
      }

      // Agenda (Próximos 7 días)
      // Mapear el nombre del paciente a la cita ya que viene solo el paciente_id
      const patientsMap = pacientes.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      
      const agenda = citas.filter(c => c.fecha >= todayStr && c.fecha <= nextWeekStr && c.estado === 'Pendiente')
          .map(c => ({
            ...c,
            paciente: patientsMap[c.paciente_id]?.nombre || 'Desconocido',
            dueno: patientsMap[c.paciente_id]?.dueno || 'Desconocido'
          }))
          .sort((a,b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

      setData({
        kpis: { citasHoy, citasSemana, ingresosMes, stockBajo },
        chart: last7Days,
        agenda,
        totalPacientes: pacientes.length
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!data.kpis) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando resumen gerencial...</div>;

  // Formatear fechas para mostrar en texto
  const todayFormat = new Date().toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });

  const showFinancials = userRole === 'Administrador' || userRole === 'Recepcionista';
  const showReportButton = userRole === 'Administrador';
  const showBillingButton = userRole === 'Administrador' || userRole === 'Recepcionista';

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* ── KPIs Superiores ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(14, 165, 233, 0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: '#0ea5e9' }}>
            <Stethoscope size={20} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1, marginBottom: '0.5rem', color: 'var(--text-main)' }}>{data.kpis.citasHoy}</h2>
          <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Consultas hoy</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{todayFormat}</p>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: '#8b5cf6' }}>
            <ClipboardList size={20} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1, marginBottom: '0.5rem', color: 'var(--text-main)' }}>{data.kpis.citasSemana}</h2>
          <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Consultas esta semana</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>Semana en curso</p>
        </div>

        {showFinancials ? (
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(34, 197, 94, 0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: '#22c55e' }}>
              <DollarSign size={20} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1, marginBottom: '0.5rem', color: 'var(--text-main)' }}>L {data.kpis.ingresosMes.toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h2>
            <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Ingresos del mes</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>Cobros realizados</p>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: '#10b981' }}>
              <Users size={20} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1, marginBottom: '0.5rem', color: 'var(--text-main)' }}>{data.totalPacientes}</h2>
            <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Pacientes Registrados</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>Fichas clínicas activas</p>
          </div>
        )}

        {/* El panel de Stock solo aparece si hay un problema */}
        {data.kpis.stockBajo > 0 && (
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1, marginBottom: '0.5rem', color: 'var(--text-main)' }}>{data.kpis.stockBajo}</h2>
            <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>Stock crítico</p>
            <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.2rem' }}>Insumos bajo mínimo</p>
          </div>
        )}
      </div>

      {/* ── Gráfico y Agenda (Sección Media) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: showFinancials ? '2fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Gráfico de Ingresos (Solo para Admin/Recep) */}
        {showFinancials && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <Activity size={18} color="#0ea5e9" /> Ingresos últimos 7 días
            </h3>
            <div style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 11}} tickFormatter={v => `L${v}`} />
                  <Tooltip contentStyle={{ background: 'var(--glass)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} formatter={v => [`L ${v.toLocaleString('es-HN', {minimumFractionDigits: 2})}`, 'Ingresos']} />
                  <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Agenda Próximos 7 días */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <CalendarClock size={18} color="#8b5cf6" /> Agenda (Próximos 7 días)
          </h3>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            {data.agenda.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                <Stethoscope size={32} opacity={0.3} style={{ marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.85rem' }}>Sin consultas pendientes próximas</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {data.agenda.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: 4, height: 32, background: '#8b5cf6', borderRadius: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', fontSize: '0.85rem', margin: 0, color: 'var(--text-main)' }}>{c.paciente}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>{c.servicio} ({c.dueno})</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: '600', margin: 0, color: 'var(--text-main)' }}>{c.hora}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{c.fecha}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Acciones Rápidas (Inferior) ── */}
      <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1rem', marginTop: '2rem', color: 'var(--text-main)' }}>Acciones rápidas</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {userRole !== 'Veterinario' && (
          <button className="glass-card" onClick={() => setTab('citas')} style={{ background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.1)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}>
            <ClipboardList size={24} color="#0ea5e9" />
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#0ea5e9' }}>Nueva cita / Consulta</span>
          </button>
        )}

        <button className="glass-card" onClick={() => setTab('pacientes')} style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}>
          <Stethoscope size={24} color="#8b5cf6" />
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#8b5cf6' }}>Expedientes Clínicos</span>
        </button>

        <button className="glass-card" onClick={() => setTab('inventario')} style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}>
          <Beaker size={24} color="#22c55e" />
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#22c55e' }}>Inventario de Insumos</span>
        </button>

        {showBillingButton && (
          <button className="glass-card" onClick={() => setTab('facturas')} style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}>
            <DollarSign size={24} color="#6366f1" />
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#6366f1' }}>Facturación y Pagos</span>
          </button>
        )}

        {showReportButton && (
          <button className="glass-card" onClick={() => setTab('reportes')} style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}>
            <FileBarChart size={24} color="#f59e0b" />
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#f59e0b' }}>Reportes MIS</span>
          </button>
        )}

      </div>
 
    </div>
  );
}
