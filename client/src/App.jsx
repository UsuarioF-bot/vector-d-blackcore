import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Calendar, Package, FileBarChart, Settings, Search, Bell, Plus, Moon, Sun, DollarSign, LogOut, ShieldAlert } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Pacientes from './components/Pacientes';
import Citas from './components/Citas';
import Inventario from './components/Inventario';
import Reportes from './components/Reportes';
import Facturas from './components/Facturas';
import Usuarios from './components/Usuarios';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pacientes', label: 'Pacientes y Clientes', icon: Users },
  { id: 'citas', label: 'Citas', icon: Calendar },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'facturas', label: 'Facturación', icon: DollarSign },
  { id: 'reportes', label: 'Reportes MIS', icon: FileBarChart },
  { id: 'usuarios', label: 'Personal / Roles', icon: Settings },
];

const TITLES = {
  dashboard: 'Panel de Control Gerencial',
  pacientes: 'Expedientes de Pacientes y Clientes',
  citas: 'Agenda de Citas y Control de Disponibilidad',
  inventario: 'Control de Medicamentos e Insumos',
  facturas: 'Módulo de Facturación y Control de Pagos',
  reportes: 'Centro de Reportes y Analítica',
  usuarios: 'Gestión de Usuarios y Roles del Sistema',
};

import Login from './components/Login';
import { useAuth } from './AuthContext';

export default function App() {
  const { currentUser, userRole, userNombre, logout } = useAuth();

  const user = currentUser ? { 
    nombre: userNombre || currentUser.displayName || currentUser.email, 
    rol: userRole, 
    email: currentUser.email 
  } : null;
  const [tab, setTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [vaccineReminders, setVaccineReminders] = useState([]);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      // 1. Alertas de Inventario
      const invData = await import('./services/db').then(m => m.getInventory());
      const alertsData = invData.filter(i => i.stock <= i.minimo);
      setAlerts(alertsData);

      // 2. Alertas de vacunas programadas próximas
      // Por simplicidad, obtenemos todas las vacunas de todos los pacientes 
      // y filtramos localmente (para no crear índices complejos ahora)
      const pts = await import('./services/db').then(m => m.getPatients());
      let todasVacunas = [];
      for (const p of pts) {
        const vacs = await import('./services/db').then(m => m.getVaccines(p.id));
        todasVacunas = [...todasVacunas, ...vacs.map(v => ({ ...v, paciente: p.nombre, dueno: p.dueno }))];
      }
      
      const limite = new Date();
      limite.setDate(limite.getDate() + 10);
      const proximas = todasVacunas.filter(v => v.estado === 'Programada' && v.fecha_proxima && new Date(v.fecha_proxima) <= limite);
      setVaccineReminders(proximas);
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [tab, user]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const q = searchQuery.toLowerCase();
      if (q.includes('reporte') || q.includes('grafic') || q.includes('ingreso')) {
        if (user.rol === 'Administrador') setTab('reportes');
      }
      else if (q.includes('paciente') || q.includes('cliente') || q.includes('dueño')) setTab('pacientes');
      else if (q.includes('cita') || q.includes('agenda')) setTab('citas');
      else if (q.includes('inventario') || q.includes('stock') || q.includes('producto')) setTab('inventario');
      else if (q.includes('factura') || q.includes('pago') || q.includes('cobro')) {
        if (user.rol !== 'Veterinario') setTab('facturas');
      }
      else setTab('dashboard');
      setSearchQuery('');
    }
  };

  if (!currentUser) {
    return <Login />;
  }

  // Usuario logueado pero sin rol asignado en el sistema → Acceso denegado
  if (!userRole) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <ShieldAlert size={48} color="#ef4444" />
        <h2 style={{ fontWeight: '800', fontSize: '1.5rem' }}>Acceso No Autorizado</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '380px' }}>
          Tu cuenta <strong>{currentUser.email}</strong> no está registrada en el sistema.
          Contacta al administrador para que te asigne un rol.
        </p>
        <button className="btn-ghost" onClick={handleLogout} style={{ marginTop: '1rem' }}>
          <LogOut size={16}/> Cerrar Sesión
        </button>
      </div>
    );
  }

  // Filtrar el menú de navegación basado en el rol de usuario
  const filteredNav = NAV.filter(item => {
    if (user.rol === 'Veterinario') {
      return ['dashboard', 'pacientes', 'citas', 'inventario'].includes(item.id);
    }
    if (user.rol === 'Recepcionista') {
      return ['dashboard', 'pacientes', 'citas', 'inventario', 'facturas'].includes(item.id);
    }
    return true; // Administrador tiene todo
  });

  const totalAlertsCount = alerts.length + vaccineReminders.length;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #1e40af, #2563eb)', borderRadius: '12px', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: '1.3rem' }}>🐾</span>
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', lineHeight: 1 }}>VET-MIS</h2>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sistema Gerencial</p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {filteredNav.map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={19}/> {label}
            </div>
          ))}
        </nav>

        <div className="nav-item" style={{ marginTop: 'auto' }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>} {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
        </div>

        {/* Perfil del Usuario */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <p style={{ fontWeight: '700', fontSize: '0.85rem', margin: 0, color: 'var(--text-main)' }}>{user.nombre}</p>
            <span className="badge badge-info" style={{ fontSize: '0.68rem', marginTop: '3px', padding: '1px 8px' }}>{user.rol}</span>
          </div>
          <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', padding: '0.5rem', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', borderRadius: '8px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <LogOut size={14}/> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>{TITLES[tab] || 'Panel Veterinario'}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {new Date().toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="glass-card" style={{ padding: '0.6rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} color="var(--text-muted)"/>
              <input 
                type="text" 
                placeholder="Buscar (ej. 'citas')..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', width: '180px', color: 'var(--text-main)' }}
              />
            </div>
            
            <div style={{ position: 'relative' }}>
              <div className="glass-card" onClick={() => setShowNotifications(!showNotifications)} style={{ padding: '0.65rem', borderRadius: '12px', cursor: 'pointer', position: 'relative' }}>
                <Bell size={18}/>
                {totalAlertsCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', width: '10px', height: '10px', borderRadius: '50%' }} />}
              </div>
              
              {showNotifications && (
                <div className="glass-card" style={{ position: 'absolute', top: '120%', right: 0, width: '320px', padding: '1rem', zIndex: 100, background: 'var(--bg-sidebar)', maxHeight: '300px', overflowY: 'auto' }}>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>Notificaciones</h4>
                  {totalAlertsCount === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No hay alertas recientes.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* Alertas de Inventario */}
                      {alerts.map(a => (
                        <div key={'inv-' + a.id} style={{ padding: '0.65rem', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444', borderRadius: '4px' }}>
                          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Stock crítico: {a.producto}</p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Quedan {a.stock} unidades (Mín: {a.minimo})</p>
                        </div>
                      ))}

                      {/* Alertas de Vacunación */}
                      {vaccineReminders.map(v => {
                        const esVencida = new Date(v.fecha_proxima) < new Date();
                        return (
                          <div key={'vac-' + v.id} style={{ padding: '0.65rem', background: esVencida ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.08)', borderLeft: `3px solid ${esVencida ? '#f59e0b' : '#3b82f6'}`, borderRadius: '4px' }}>
                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Vacuna {esVencida ? 'Vencida' : 'Próxima'}: {v.vacuna_nombre}</p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Paciente: <b>{v.paciente}</b> ({v.dueno})</p>
                            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: esVencida ? '#f59e0b' : '#3b82f6', margin: 0 }}>Vence: {v.fecha_proxima}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {tab !== 'citas' && (
              <button className="btn-primary" onClick={() => setTab('citas')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                <Plus size={18}/> Nueva Cita
              </button>
            )}
          </div>
        </header>

        {tab === 'dashboard' && <Dashboard setTab={setTab} userRole={user.rol} />}
        {tab === 'pacientes' && <Pacientes userRole={user.rol} userNombre={user.nombre} />}
        {tab === 'citas' && <Citas userRole={user.rol} />}
        {tab === 'inventario' && <Inventario userRole={user.rol} />}
        {/* Tabs con verificación de rol en el servidor para prevenir acceso forzado */}
        {tab === 'facturas' && (user.rol === 'Administrador' || user.rol === 'Recepcionista'
          ? <Facturas userRole={user.rol} />
          : <div style={{padding:'3rem',textAlign:'center',color:'var(--text-muted)'}}><ShieldAlert size={32} style={{marginBottom:'1rem',color:'#ef4444'}}/><p>No tienes permiso para ver esta sección.</p></div>
        )}
        {tab === 'reportes' && (user.rol === 'Administrador'
          ? <Reportes />
          : <div style={{padding:'3rem',textAlign:'center',color:'var(--text-muted)'}}><ShieldAlert size={32} style={{marginBottom:'1rem',color:'#ef4444'}}/><p>No tienes permiso para ver esta sección.</p></div>
        )}
        {tab === 'usuarios' && (user.rol === 'Administrador'
          ? <Usuarios userRole={user.rol} currentUserEmail={user.email} />
          : <div style={{padding:'3rem',textAlign:'center',color:'var(--text-muted)'}}><ShieldAlert size={32} style={{marginBottom:'1rem',color:'#ef4444'}}/><p>Solo los administradores pueden gestionar usuarios.</p></div>
        )}
      </main>
    </div>
  );
}
