import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, CheckCircle, Clock, AlertCircle, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAppointments, addAppointment, updateAppointment, getPatients, addPatient } from '../services/db';

const SERVICIOS = ['Consulta General', 'Vacunación', 'Desparasitación', 'Ecografía', 'Cirugía Menor', 'Control Post-Op', 'Urgencia', 'Estética', 'Laboratorio'];
const ESTADOS = ['Pendiente', 'En Proceso', 'Completado', 'Cancelado'];

const estadoConfig = {
  Completado: { cls: 'badge-success', icon: CheckCircle, color: '#10b981' },
  'En Proceso': { cls: 'badge-warning', icon: Clock, color: '#f59e0b' },
  Pendiente: { cls: 'badge-info', icon: AlertCircle, color: '#3b82f6' },
  Cancelado: { cls: 'badge-danger', icon: X, color: '#ef4444' },
};

// Formato Lempiras hondureños
const fmtLPS = (n) => `L ${Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Citas({ userRole }) {
  const getLocalStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [citas, setCitas] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);
  
  // Formulario y estado de edición
  const [form, setForm] = useState({ paciente_id: '', fecha: getLocalStr(), hora: '09:00', servicio: 'Consulta General', monto: '' });
  const [editingCitaId, setEditingCitaId] = useState(null);
  const [disponibilidadAlerta, setDisponibilidadAlerta] = useState(false);
  
  // Estado para creación rápida de paciente
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ nombre: '', dueno: '', especie: 'Canino' });

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    try {
      const [c, p] = await Promise.all([
        getAppointments(),
        getPatients(),
      ]);
      
      // Mapear los nombres de paciente/dueño en las citas
      const patientsMap = p.reduce((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
      }, {});
      
      const citasCompletas = c.map(cita => {
        const pac = patientsMap[cita.paciente_id];
        return {
          ...cita,
          paciente: pac ? pac.nombre : 'Desconocido',
          dueno: pac ? pac.dueno : 'Desconocido'
        };
      });
      
      setCitas(citasCompletas); 
      setPatients(p);
      if (p.length > 0 && !form.paciente_id) setForm(f => ({ ...f, paciente_id: p[0].id }));
    } catch (e) {
      console.error(e);
    }
  };

  // Comprobar disponibilidad en tiempo real
  useEffect(() => {
    if (!form.fecha || !form.hora) return;
    const checkAvailability = () => {
      const conflicting = citas.find(c => c.fecha === form.fecha && c.hora === form.hora && c.id !== editingCitaId && c.estado !== 'Cancelado');
      setDisponibilidadAlerta(!!conflicting);
    };
    const delayDebounce = setTimeout(checkAvailability, 300);
    return () => clearTimeout(delayDebounce);
  }, [form.fecha, form.hora, editingCitaId, showModal, citas]);

  const handleSaveQuickPatient = async () => {
    if (!newPatientForm.nombre || !newPatientForm.dueno) return alert('Nombre y propietario requeridos');
    try {
      await addPatient({ ...newPatientForm, raza: '', telefono: '', email: '', edad: '', peso: '' });
      await load();
      setShowNewPatient(false);
      setNewPatientForm({ nombre: '', dueno: '', especie: 'Canino' });
    } catch (e) {
      console.error(e);
      alert("Error al guardar paciente");
    }
  };

  const handleSave = async () => {
    if (!form.paciente_id || !form.monto) return alert('Selecciona paciente y monto');
    
    try {
      const dataToSave = {
        paciente_id: form.paciente_id,
        fecha: form.fecha,
        hora: form.hora,
        servicio: form.servicio,
        monto: parseFloat(form.monto),
        estado: editingCitaId ? citas.find(c => c.id === editingCitaId)?.estado || 'Pendiente' : 'Pendiente'
      };

      if (editingCitaId) {
        await updateAppointment(editingCitaId, dataToSave);
      } else {
        await addAppointment(dataToSave);
      }
      
      await load(); 
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Error al guardar cita");
    }
  };

  const handleEditClick = (c) => {
    setEditingCitaId(c.id);
    setForm({
      paciente_id: c.paciente_id,
      fecha: c.fecha,
      hora: c.hora,
      servicio: c.servicio,
      monto: c.monto
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCitaId(null);
    setForm({ paciente_id: patients[0]?.id || '', fecha: getLocalStr(), hora: '09:00', servicio: 'Consulta General', monto: '' });
    setDisponibilidadAlerta(false);
    setShowNewPatient(false);
  };

  const cambiarEstado = async (id, estado) => {
    try {
      await updateAppointment(id, { estado });
      
      if (estado === 'Completado') {
        const cita = citas.find(c => c.id === id);
        if (cita) {
          const ISV_RATE = 0.15;
          const total = parseFloat(cita.monto || 0);
          const subtotal = total / (1 + ISV_RATE);
          const impuesto = total - subtotal;
          
          const { addInvoice } = await import('../services/db');
          await addInvoice({
            cita_id: id,
            paciente_id: cita.paciente_id,
            paciente: cita.paciente,
            dueno: cita.dueno,
            servicio: cita.servicio || 'Servicio Veterinario',
            subtotal,
            impuesto,
            total,
            estado: 'Pendiente',
            metodo_pago: '',
            fecha: getLocalStr()
          });
        }
      }
      
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filter === 'Todas' ? citas : citas.filter(c => c.estado === filter);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const canModifyCita = userRole === 'Administrador' || userRole === 'Recepcionista';

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', fontSize: '1.25rem' }}>Gestión de Citas</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{citas.length} citas en total</p>
        </div>
        {canModifyCita && (
          <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18}/> Nueva Cita</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['Todas', ...ESTADOS].map(e => (
          <button
            key={e}
            type="button"
            onClick={() => setFilter(e)}
            className={`filter-pill${filter === e ? ' active' : ''}`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '700px' }}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Propietario</th>
              <th>Servicio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
              <th>Monto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map(c => {
              const cfg = estadoConfig[c.estado] || estadoConfig['Pendiente'];
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: '600' }}>{c.paciente}</td>
                  <td>{c.dueno}</td>
                  <td>{c.servicio}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.fecha}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.hora}</td>
                  <td><span className={`badge ${cfg.cls}`}>{c.estado}</span></td>
                  <td style={{ fontWeight: '700' }}>{fmtLPS(c.monto)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        className="form-select"
                        value={c.estado}
                        onChange={e => cambiarEstado(c.id, e.target.value)}
                        style={{ height: '32px' }}
                      >
                        {ESTADOS.map(e => <option key={e}>{e}</option>)}
                      </select>
                      
                      {canModifyCita && c.estado !== 'Completado' && c.estado !== 'Cancelado' && (
                        <button 
                          className="btn-ghost" 
                          onClick={() => handleEditClick(c)}
                          style={{ padding: '4px 8px', borderRadius: '8px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Reprogramar cita"
                        >
                          <Edit3 size={14}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              className="btn-ghost" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px' }}
            >
              <ChevronLeft size={18}/>
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
              Página {currentPage} de {totalPages}
            </span>
            <button 
              className="btn-ghost" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px' }}
            >
              <ChevronRight size={18}/>
            </button>
          </div>
        )}

        {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay citas en esta categoría</p>}
      </div>

      {/* Modal — renderizado via createPortal para posicionamiento correcto */}
      {showModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={closeModal}>
          <div
            className="modal-panel"
            style={{ padding: '2.5rem', width: '520px', maxWidth: '95vw' }}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Cerrar">
              <X size={20}/>
            </button>
            <h3 style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '0.5rem', paddingRight: '2rem' }}>
              {editingCitaId ? 'Reprogramar Cita' : 'Agendar Nueva Cita'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Las citas en Pendiente se cancelan automáticamente 1 h después de la hora programada si no se actualizan.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              
              {disponibilidadAlerta && (
                <div style={{ gridColumn: '1 / -1', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#f59e0b', fontSize: '0.78rem', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: '500' }}>
                  <AlertCircle size={15}/> <b>¡Conflicto de agenda!</b> Ya existe otra cita programada para esta fecha y hora.
                </div>
              )}

              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Paciente *</label>
                  {!editingCitaId && (
                    <button onClick={() => setShowNewPatient(!showNewPatient)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Plus size={14}/> {showNewPatient ? 'Cancelar' : 'Nuevo Paciente'}
                    </button>
                  )}
                </div>
                
                {showNewPatient ? (
                  <div className="surface-inset" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input className="form-input" placeholder="Nombre Mascota" value={newPatientForm.nombre} onChange={e => setNewPatientForm({...newPatientForm, nombre: e.target.value})} />
                      <input className="form-input" placeholder="Nombre Dueño" value={newPatientForm.dueno} onChange={e => setNewPatientForm({...newPatientForm, dueno: e.target.value})} />
                    </div>
                    <button className="btn-primary" onClick={handleSaveQuickPatient} style={{ width: '100%', justifyContent: 'center', padding: '0.5rem' }}>Guardar Rápido</button>
                  </div>
                ) : (
                  <select 
                    className="form-input" 
                    value={form.paciente_id} 
                    onChange={e => setForm({ ...form, paciente_id: e.target.value })}
                    disabled={!!editingCitaId}
                  >
                    <option value="">Selecciona un paciente...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.dueno})</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}/>
              </div>
              <div>
                <label className="form-label">Hora *</label>
                <input className="form-input" type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}/>
              </div>
              <div>
                <label className="form-label">Servicio</label>
                <select className="form-input" value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })}>
                  {SERVICIOS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Monto (L) *</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00"/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave}>
                {editingCitaId ? 'Reprogramar Cita' : 'Guardar Cita'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
