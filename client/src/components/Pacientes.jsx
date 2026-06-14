import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Cat, Dog, X, Bird, Rabbit, Turtle, FileText, Activity, Calendar, ShieldAlert, Award, ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { getPatients, getMedicalHistory, getVaccines, addPatient, addMedicalHistory, addVaccine, updateVaccine, updatePatient, deletePatient, updateMedicalHistory, deleteMedicalHistory, deleteVaccine } from '../services/db';

const ESPECIES = ['Canino', 'Felino', 'Ave', 'Reptil', 'Roedor', 'Otro'];

export default function Pacientes({ userRole, userNombre }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
  
  // EMR Details
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'vaccines'
  
  // Modales adicionales
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showApplyVaccineModal, setShowApplyVaccineModal] = useState(false);
  const [selectedVaccineToApply, setSelectedVaccineToApply] = useState(null);

  // Formularios
  const [form, setForm] = useState({ nombre: '', especie: 'Canino', raza: '', dueno: '', telefono: '', email: '', edad: '', edadVal: '', edadUnit: 'años', peso: '' });
  const [historyForm, setHistoryForm] = useState({ fecha: new Date().toISOString().split('T')[0], veterinario: userNombre || '', tipo: 'Consulta', diagnostico: '', tratamiento: '', peso: '', observaciones: '' });
  const [vaccineForm, setVaccineForm] = useState({ vacuna_nombre: '', fecha_aplicacion: new Date().toISOString().split('T')[0], fecha_proxima: '', lote: '', estado: 'Aplicada' });
  const [applyVaccineForm, setApplyVaccineForm] = useState({ fecha_aplicacion: new Date().toISOString().split('T')[0], lote: '' });

  const [saving, setSaving] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingVaccineId, setEditingVaccineId] = useState(null);

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = async () => {
    try {
      const data = await getPatients();
      setPatients(data);
    } catch (error) {
      console.error("Error loading patients:", error);
    }
  };

  const handlePatientClick = async (p) => {
    setSelectedPatient(p);
    setHistoryForm(f => ({ ...f, veterinario: userNombre || '' }));
    loadEMRData(p.id);
  };

  const loadEMRData = async (patientId) => {
    try {
      const [historyData, vaccinesData] = await Promise.all([
        getMedicalHistory(patientId),
        getVaccines(patientId)
      ]);
      setMedicalHistory(historyData);
      setVaccines(vaccinesData);
    } catch (error) {
      console.error("Error loading EMR:", error);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPatientId(null);
    setForm({ nombre: '', especie: 'Canino', raza: '', dueno: '', telefono: '', email: '', edad: '', edadVal: '', edadUnit: 'años', peso: '' });
  };

  const handleEditClick = (p) => {
    setEditingPatientId(p.id);
    
    // Parsear la edad para separar número de unidad
    let val = '';
    let unit = 'años';
    if (p.edad) {
      const match = p.edad.trim().match(/^(\d+)\s*(años|meses|semanas)$/i);
      if (match) {
        val = match[1];
        unit = match[2].toLowerCase();
      } else {
        const numOnly = p.edad.trim().match(/^(\d+)$/);
        if (numOnly) {
          val = numOnly[1];
        } else {
          val = p.edad;
        }
      }
    }

    setForm({
      nombre: p.nombre,
      especie: p.especie || 'Canino',
      raza: p.raza || '',
      dueno: p.dueno || '',
      telefono: p.telefono || '',
      email: p.email || '',
      edad: p.edad || '',
      edadVal: val,
      edadUnit: unit,
      peso: p.peso || ''
    });
    setShowModal(true);
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este paciente y todos sus datos?')) return;
    setSaving(true);
    try {
      await deletePatient(id);
      setSelectedPatient(null);
      await loadPatients();
    } catch (error) {
      console.error("Error deleting patient:", error);
      alert("Error al eliminar paciente");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.nombre || !form.dueno) return alert('Nombre del paciente y propietario son obligatorios');
    setSaving(true);
    
    const body = {
      nombre: form.nombre,
      especie: form.especie,
      raza: form.raza,
      dueno: form.dueno,
      telefono: form.telefono,
      email: form.email,
      edad: form.edad,
      peso: form.peso ? parseFloat(form.peso) : null
    };

    try {
      if (editingPatientId) {
        await updatePatient(editingPatientId, body);
        setSelectedPatient(prev => ({ ...prev, ...body }));
      } else {
        await addPatient(body);
      }
      await loadPatients();
      closeModal();
    } catch (error) {
      console.error("Error saving patient:", error);
      alert("Error al guardar paciente");
    } finally {
      setSaving(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setEditingHistoryId(null);
    setHistoryForm({ fecha: new Date().toISOString().split('T')[0], veterinario: userNombre || '', tipo: 'Consulta', diagnostico: '', tratamiento: '', peso: '', observaciones: '' });
  };

  const handleEditHistoryClick = (item) => {
    setEditingHistoryId(item.id);
    setHistoryForm({
      fecha: item.fecha || new Date().toISOString().split('T')[0],
      veterinario: item.veterinario || '',
      tipo: item.tipo || 'Consulta',
      diagnostico: item.diagnostico || '',
      tratamiento: item.tratamiento || '',
      peso: item.peso || '',
      observaciones: item.observaciones || ''
    });
    setShowHistoryModal(true);
  };

  const handleDeleteHistoryClick = async (historyId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro clínico?')) return;
    setSaving(true);
    try {
      await deleteMedicalHistory(selectedPatient.id, historyId);
      await loadEMRData(selectedPatient.id);
    } catch (error) {
      console.error("Error deleting history:", error);
      alert("Error al eliminar el registro clínico");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHistory = async () => {
    if (!historyForm.diagnostico) return alert('El diagnóstico es obligatorio');
    setSaving(true);
    try {
      if (editingHistoryId) {
        await updateMedicalHistory(selectedPatient.id, editingHistoryId, historyForm);
      } else {
        await addMedicalHistory(selectedPatient.id, historyForm);
      }
      await loadEMRData(selectedPatient.id);
      if (historyForm.peso) {
        setSelectedPatient(prev => ({ ...prev, peso: parseFloat(historyForm.peso) }));
        await loadPatients();
      }
      closeHistoryModal();
    } catch (error) {
      console.error("Error saving history:", error);
      alert("Error al guardar historial");
    } finally {
      setSaving(false);
    }
  };

  const closeVaccineModal = () => {
    setShowVaccineModal(false);
    setEditingVaccineId(null);
    setVaccineForm({ vacuna_nombre: '', fecha_aplicacion: new Date().toISOString().split('T')[0], fecha_proxima: '', lote: '', estado: 'Aplicada' });
  };

  const handleEditVaccineClick = (item) => {
    setEditingVaccineId(item.id);
    setVaccineForm({
      vacuna_nombre: item.vacuna_nombre || '',
      fecha_aplicacion: item.fecha_aplicacion || new Date().toISOString().split('T')[0],
      fecha_proxima: item.fecha_proxima || '',
      lote: item.lote || '',
      estado: item.estado || 'Aplicada'
    });
    setShowVaccineModal(true);
  };

  const handleDeleteVaccineClick = async (vaccineId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de vacuna?')) return;
    setSaving(true);
    try {
      await deleteVaccine(selectedPatient.id, vaccineId);
      await loadEMRData(selectedPatient.id);
    } catch (error) {
      console.error("Error deleting vaccine:", error);
      alert("Error al eliminar la vacuna");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVaccine = async () => {
    if (!vaccineForm.vacuna_nombre) return alert('El nombre de la vacuna es obligatorio');
    setSaving(true);
    try {
      if (editingVaccineId) {
        await updateVaccine(selectedPatient.id, editingVaccineId, vaccineForm);
      } else {
        await addVaccine(selectedPatient.id, vaccineForm);
      }
      await loadEMRData(selectedPatient.id);
      closeVaccineModal();
    } catch (error) {
      console.error("Error saving vaccine:", error);
      alert("Error al registrar vacuna");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyVaccine = async () => {
    setSaving(true);
    try {
      await updateVaccine(selectedPatient.id, selectedVaccineToApply.id, {
        estado: 'Aplicada',
        fecha_aplicacion: applyVaccineForm.fecha_aplicacion,
        lote: applyVaccineForm.lote
      });
      await loadEMRData(selectedPatient.id);
      setShowApplyVaccineModal(false);
      setSelectedVaccineToApply(null);
      setApplyVaccineForm({ fecha_aplicacion: new Date().toISOString().split('T')[0], lote: '' });
    } catch (error) {
      console.error("Error applying vaccine:", error);
      alert("Error al aplicar vacuna");
    } finally {
      setSaving(false);
    }
  };

  const filtered = [...patients].reverse().filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.dueno.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const EspecieIcon = ({ especie }) => {
    const colors = { Canino: '#f59e0b', Felino: '#8b5cf6', Ave: '#10b981', Reptil: '#ef4444', Roedor: '#f97316', Otro: '#64748b' };
    return (
      <div style={{ width: 38, height: 38, borderRadius: '10px', background: (colors[especie] || '#64748b') + '20', display: 'grid', placeItems: 'center', color: colors[especie] || '#64748b', fontWeight: '700', fontSize: '0.75rem' }}>
        {especie === 'Canino' ? <Dog size={18}/> : 
         especie === 'Felino' ? <Cat size={18}/> : 
         especie === 'Ave' ? <Bird size={18}/> : 
         especie === 'Reptil' ? <Turtle size={18}/> : 
         especie === 'Roedor' ? <Rabbit size={18}/> : especie[0]}
      </div>
    );
  };

  const canEditMedical = userRole === 'Administrador' || userRole === 'Veterinario';

  // --- RENDERING DETAIL VIEW ---
  if (selectedPatient) {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
        {/* Header Expediente */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button className="btn-ghost" onClick={() => { setSelectedPatient(null); loadPatients(); }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ChevronLeft size={16}/> Volver al Listado
          </button>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {activeTab === 'history' && canEditMedical && (
              <button className="btn-primary" onClick={() => setShowHistoryModal(true)}>
                <Plus size={16}/> Registrar Consulta
              </button>
            )}
            {activeTab === 'vaccines' && canEditMedical && (
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={() => setShowVaccineModal(true)}>
                <Plus size={16}/> Registrar Vacuna
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Columna Izquierda: Información de Ficha */}
          <div className="glass-card" style={{ padding: '1.5rem', position: 'sticky', top: '100px' }}>
            <div style={{ position: 'absolute', top: '0.9rem', right: '0.9rem', display: 'flex', gap: '6px' }}>
              <button onClick={() => handleEditClick(selectedPatient)} className="btn-ghost" style={{ padding: '4px 6px', background: 'var(--surface-muted)', borderRadius: '7px', border: 'none', color: 'var(--text-muted)' }} title="Editar Datos">
                <Edit3 size={13}/>
              </button>
              <button onClick={() => handleDeleteClick(selectedPatient.id)} className="btn-ghost" style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: '7px', border: 'none', color: '#ef4444' }} title="Eliminar Paciente">
                <Trash2 size={13}/>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
              <EspecieIcon especie={selectedPatient.especie}/>
              <h3 style={{ fontWeight: '800', fontSize: '1.25rem', marginTop: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>{selectedPatient.nombre}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>ID Mascota: #{selectedPatient.id}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Especie / Raza</p>
                <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>{selectedPatient.especie} · {selectedPatient.raza || 'No especificada'}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Edad</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>{selectedPatient.edad || 'No registrada'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Peso Actual</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>{selectedPatient.peso ? `${selectedPatient.peso} kg` : 'No registrado'}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>👤 PROPIETARIO</p>
                <p style={{ fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>{selectedPatient.dueno}</p>
                {selectedPatient.telefono && <p style={{ color: 'var(--text-muted)', margin: '0 0 2px 0', fontSize: '0.8rem' }}>📞 {selectedPatient.telefono}</p>}
                {selectedPatient.email && <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.8rem' }}>✉️ {selectedPatient.email}</p>}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Contenido del Expediente */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Tabs Selector */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setActiveTab('history')}
                className={`filter-pill${activeTab === 'history' ? ' active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FileText size={16}/> Historial Clínico (EMR)
              </button>
              <button 
                onClick={() => setActiveTab('vaccines')}
                className={`filter-pill${activeTab === 'vaccines' ? ' active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Award size={16}/> Control de Vacunación
              </button>
            </div>

            {/* Tab Contenido: Historial Médico */}
            {activeTab === 'history' && (
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Consultas y Diagnósticos Recientes</h4>
                
                {medicalHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0', fontSize: '0.9rem' }}>No hay registros clínicos en el historial de este paciente.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {medicalHistory.map((item, index) => (
                      <div key={'mh-' + item.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                        {/* Línea vertical decorativa */}
                        {index < medicalHistory.length - 1 && (
                          <div style={{ position: 'absolute', top: '30px', left: '17px', bottom: '-30px', width: '2px', background: 'var(--border-color)' }} />
                        )}
                        
                        {/* Icono de tipo */}
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', display: 'grid', placeItems: 'center', zIndex: 1, minWidth: '36px' }}>
                          <Activity size={18}/>
                        </div>

                        {/* Detalle */}
                        <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', paddingRight: canEditMedical ? '4.5rem' : '0' }}>
                            <div>
                              <span className="badge badge-info" style={{ marginRight: '6px' }}>{item.tipo}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.fecha}</span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🩺 {item.veterinario}</span>
                          </div>
                          {canEditMedical && (
                            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', gap: '4px' }}>
                              <button onClick={() => handleEditHistoryClick(item)} className="btn-ghost" style={{ padding: '4px 6px', background: 'var(--surface-muted)', borderRadius: '6px', border: 'none', color: 'var(--text-muted)' }} title="Editar">
                                <Edit3 size={12}/>
                              </button>
                              <button onClick={() => handleDeleteHistoryClick(item.id)} className="btn-ghost" style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: 'none', color: '#ef4444' }} title="Eliminar">
                                <Trash2 size={12}/>
                              </button>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}><b>Diagnóstico:</b> {item.diagnostico}</p>
                            {item.tratamiento && (
                              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', background: 'rgba(16, 185, 129, 0.05)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                                <b>Receta / Tratamiento:</b> {item.tratamiento}
                              </p>
                            )}
                            {item.peso && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>⚖️ Peso registrado: {item.peso} kg</p>}
                            {item.observaciones && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}><b>Notas:</b> {item.observaciones}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab Contenido: Vacunas */}
            {activeTab === 'vaccines' && (
              <div className="glass-card" style={{ padding: '1.75rem', overflowX: 'auto' }}>
                <h4 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Esquema de Vacunación</h4>
                
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>Vacuna</th>
                      <th>Fecha de Aplicación</th>
                      <th>Próximo Refuerzo</th>
                      <th>Lote</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaccines.map(v => {
                      const esVencida = v.estado === 'Programada' && new Date(v.fecha_proxima) < new Date();
                      return (
                        <tr key={'vac-' + v.id}>
                          <td style={{ fontWeight: 600 }}>{v.vacuna_nombre}</td>
                          <td>{v.estado === 'Aplicada' ? v.fecha_aplicacion : '—'}</td>
                          <td>{v.fecha_proxima || 'Sin refuerzo'}</td>
                          <td>{v.lote || '—'}</td>
                          <td>
                            {v.estado === 'Aplicada' ? (
                              <span className="badge badge-success">Aplicada</span>
                            ) : esVencida ? (
                              <span className="badge badge-danger">Vencida</span>
                            ) : (
                              <span className="badge badge-warning">Programada</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {v.estado === 'Programada' && canEditMedical && (
                                <button 
                                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
                                  onClick={() => { setSelectedVaccineToApply(v); setShowApplyVaccineModal(true); }}
                                >
                                  Aplicar
                                </button>
                              )}
                              {canEditMedical && (
                                <>
                                  <button onClick={() => handleEditVaccineClick(v)} className="btn-ghost" style={{ padding: '4px 6px', background: 'var(--surface-muted)', borderRadius: '6px', border: 'none', color: 'var(--text-muted)' }} title="Editar">
                                    <Edit3 size={12}/>
                                  </button>
                                  <button onClick={() => handleDeleteVaccineClick(v.id)} className="btn-ghost" style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: 'none', color: '#ef4444' }} title="Eliminar">
                                    <Trash2 size={12}/>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {vaccines.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay vacunas registradas.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Registrar Consulta */}
        {showHistoryModal && createPortal(
          <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={closeHistoryModal}>
            <div className="modal-panel" style={{ padding: '2.5rem', width: '560px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
              <button type="button" className="modal-close" onClick={closeHistoryModal}><X size={20}/></button>
              <h3 style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                {editingHistoryId ? 'Editar Registro Clínico' : 'Registrar Evento Clínico'}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label className="form-label">Fecha *</label>
                  <input className="form-input" type="date" value={historyForm.fecha} onChange={e => setHistoryForm({ ...historyForm, fecha: e.target.value })}/>
                </div>
                <div>
                  <label className="form-label">Tipo de Visita</label>
                  <select className="form-input" value={historyForm.tipo} onChange={e => setHistoryForm({ ...historyForm, tipo: e.target.value })}>
                    <option value="Consulta">Consulta General</option>
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Receta">Receta</option>
                    <option value="Seguimiento">Control / Seguimiento</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Veterinario</label>
                  <input className="form-input" type="text" value={historyForm.veterinario} onChange={e => setHistoryForm({ ...historyForm, veterinario: e.target.value })}/>
                </div>
                <div>
                  <label className="form-label">Peso registrado (kg)</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="Ej. 12.5" value={historyForm.peso} onChange={e => setHistoryForm({ ...historyForm, peso: e.target.value })}/>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Diagnóstico / Motivo *</label>
                  <textarea className="form-input" rows="3" placeholder="Detalla la condición observada..." value={historyForm.diagnostico} onChange={e => setHistoryForm({ ...historyForm, diagnostico: e.target.value })} style={{ resize: 'vertical', fontFamily: 'inherit' }}></textarea>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tratamiento / Receta</label>
                  <textarea className="form-input" rows="3" placeholder="Medicamentos, dosis y duración..." value={historyForm.tratamiento} onChange={e => setHistoryForm({ ...historyForm, tratamiento: e.target.value })} style={{ resize: 'vertical', fontFamily: 'inherit' }}></textarea>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Observaciones Adicionales</label>
                  <input className="form-input" placeholder="Notas internas o recomendaciones de seguimiento..." value={historyForm.observaciones} onChange={e => setHistoryForm({ ...historyForm, observaciones: e.target.value })}/>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={closeHistoryModal}>Cancelar</button>
                <button className="btn-primary" onClick={handleSaveHistory} disabled={saving}>
                  {saving ? 'Guardando...' : editingHistoryId ? 'Guardar Cambios' : 'Guardar Consulta'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Registrar/Programar Vacuna */}
        {showVaccineModal && createPortal(
          <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={closeVaccineModal}>
            <div className="modal-panel" style={{ padding: '2.5rem', width: '500px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
              <button type="button" className="modal-close" onClick={closeVaccineModal}><X size={20}/></button>
              <h3 style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                {editingVaccineId ? 'Editar Vacuna' : 'Registrar Vacuna'}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                <div>
                  <label className="form-label">Nombre de la Vacuna *</label>
                  <input className="form-input" placeholder="Ej. Antirrábica, Triple Felina..." value={vaccineForm.vacuna_nombre} onChange={e => setVaccineForm({ ...vaccineForm, vacuna_nombre: e.target.value })}/>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={vaccineForm.estado} onChange={e => setVaccineForm({ ...vaccineForm, estado: e.target.value })}>
                      <option value="Aplicada">Aplicada hoy</option>
                      <option value="Programada">Programar refuerzo (pendiente)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Lote</label>
                    <input className="form-input" placeholder="Lote del frasco" value={vaccineForm.lote} onChange={e => setVaccineForm({ ...vaccineForm, lote: e.target.value })}/>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Fecha de Aplicación</label>
                    <input className="form-input" type="date" value={vaccineForm.fecha_aplicacion} onChange={e => setVaccineForm({ ...vaccineForm, fecha_aplicacion: e.target.value })}/>
                  </div>
                  <div>
                    <label className="form-label">Fecha de Refuerzo / Recordatorio</label>
                    <input className="form-input" type="date" value={vaccineForm.fecha_proxima} onChange={e => setVaccineForm({ ...vaccineForm, fecha_proxima: e.target.value })}/>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={closeVaccineModal}>Cancelar</button>
                <button className="btn-primary" onClick={handleSaveVaccine} disabled={saving} style={{ background: '#10b981' }}>
                  {saving ? 'Guardando...' : editingVaccineId ? 'Guardar Cambios' : 'Registrar Vacuna'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Aplicar Vacuna Programada */}
        {showApplyVaccineModal && createPortal(
          <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={() => setShowApplyVaccineModal(false)}>
            <div className="modal-panel" style={{ padding: '2rem', width: '400px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
              <button type="button" className="modal-close" onClick={() => setShowApplyVaccineModal(false)}><X size={20}/></button>
              <h3 style={{ fontWeight: '800', fontSize: '1.25rem', marginBottom: '1.25rem', color: 'var(--text-main)' }}>Aplicar Vacuna</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Confirma los datos de aplicación para la vacuna: <b>{selectedVaccineToApply?.vacuna_nombre}</b></p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Fecha de Aplicación</label>
                  <input className="form-input" type="date" value={applyVaccineForm.fecha_aplicacion} onChange={e => setApplyVaccineForm({ ...applyVaccineForm, fecha_aplicacion: e.target.value })}/>
                </div>
                <div>
                  <label className="form-label">Lote</label>
                  <input className="form-input" placeholder="Lote del vial" value={applyVaccineForm.lote} onChange={e => setApplyVaccineForm({ ...applyVaccineForm, lote: e.target.value })}/>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => setShowApplyVaccineModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleApplyVaccine} disabled={saving} style={{ background: '#10b981' }}>
                  {saving ? 'Guardando...' : 'Confirmar Aplicación'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // --- RENDERING GRID VIEW ---
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', fontSize: '1.25rem' }}>Pacientes y Clientes</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{patients.length} registros en total</p>
        </div>
        {userRole !== 'Veterinario' && (
          <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18}/> Nuevo Paciente</button>
        )}
      </div>

      {/* Búsqueda */}
      <div className="glass-card" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Search size={18} color="var(--text-muted)"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o propietario..." style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.9rem', color: 'var(--text-main)' }}/>
      </div>

      {/* Grid de Pacientes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {currentData.map(p => (
          <div key={p.id} className="glass-card" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => handlePatientClick(p)}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <EspecieIcon especie={p.especie}/>
              <div>
                <h4 style={{ fontWeight: '700', fontSize: '1rem', margin: 0 }}>{p.nombre}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '3px 0 0 0' }}>{p.especie} · {p.raza || 'Raza no especificada'}</p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  {p.edad && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.edad}</span>}
                  {p.edad && p.peso && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>·</span>}
                  {p.peso && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.peso} kg</span>}
                </div>
              </div>
            </div>
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: '0 0 4px 0' }}>👤 {p.dueno}</p>
              {p.telefono && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 2px 0' }}>📞 {p.telefono}</p>}
              {p.email && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>✉️ {p.email}</p>}
            </div>
          </div>
        ))}
      </div>

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

      {/* Modal Crear Paciente */}
      {showModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={closeModal}>
          <div className="modal-panel" style={{ padding: '2.5rem', width: '560px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal}><X size={20}/></button>
            <h3 style={{ fontWeight: '700', fontSize: '1.4rem', marginBottom: '2rem', color: 'var(--text-main)' }}>
              {editingPatientId ? 'Editar Paciente / Propietario' : 'Registrar Nuevo Paciente'}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Nombre del Paciente *</label>
                <input className="form-input" type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Toby" />
              </div>
              <div>
                <label className="form-label">Raza</label>
                <input className="form-input" type="text" value={form.raza} onChange={e => setForm({ ...form, raza: e.target.value })} placeholder="Ej. Golden Retriever" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Edad</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      className="form-input" 
                      type="number" 
                      min="0"
                      placeholder="3" 
                      value={form.edadVal || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setForm(prev => ({ 
                          ...prev, 
                          edadVal: val,
                          edad: val ? `${val} ${prev.edadUnit || 'años'}` : ''
                        }));
                      }} 
                      style={{ flex: 1 }}
                    />
                    <select 
                      className="form-input" 
                      value={form.edadUnit || 'años'} 
                      onChange={e => {
                        const unit = e.target.value;
                        setForm(prev => ({ 
                          ...prev, 
                          edadUnit: unit,
                          edad: prev.edadVal ? `${prev.edadVal} ${unit}` : ''
                        }));
                      }}
                      style={{ width: '90px' }}
                    >
                      <option value="años">años</option>
                      <option value="meses">meses</option>
                      <option value="semanas">semanas</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Peso (kg)</label>
                  <input className="form-input" type="number" step="0.1" value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })} placeholder="Ej. 12.4" />
                </div>
              </div>
              
              <div>
                <label className="form-label">Especie *</label>
                <select className="form-input" value={form.especie} onChange={e => setForm({ ...form, especie: e.target.value })}>
                  {ESPECIES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
 
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '1rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>Datos del Propietario</p>
              </div>
 
              <div>
                <label className="form-label">Nombre Completo *</label>
                <input className="form-input" type="text" value={form.dueno} onChange={e => setForm({ ...form, dueno: e.target.value })} placeholder="Ej. Carlos Ruiz" />
              </div>
              <div>
                <label className="form-label">Teléfono</label>
                <input className="form-input" type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej. 555-0101" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingPatientId ? 'Guardar Cambios' : 'Guardar Paciente'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
