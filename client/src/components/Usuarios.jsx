import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, User, Trash2, X, Shield, Edit3, Mail, CheckCircle } from 'lucide-react';
import { getUsers, addUserRole, updateUserRole, deleteUserRole } from '../services/db';

const ROLES = [
  { value: 'Administrador', label: 'Administrador', desc: 'Acceso total al sistema', color: '#ef4444' },
  { value: 'Veterinario', label: 'Veterinario', desc: 'EMR + Consultas + Inventario', color: '#0ea5e9' },
  { value: 'Recepcionista', label: 'Recepcionista', desc: 'Agenda + Facturación + Inventario', color: '#10b981' },
];

const rolBadgeClass = { Administrador: 'badge-danger', Veterinario: 'badge-info', Recepcionista: 'badge-success' };

// Correo del propietario supremo: nadie puede cambiar ni eliminar esta cuenta
const OWNER_EMAIL = 'aramosfugon28@gmail.com';
const OWNER_NAME = 'Angel (Propietario)';

export default function Usuarios({ userRole, currentUserEmail }) {
  const isOwner = currentUserEmail?.toLowerCase() === OWNER_EMAIL;
  const canManage = userRole === 'Administrador'; // solo admins gestionan usuarios
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = crear, objeto = editar
  const [form, setForm] = useState({ email: '', nombre: '', rol: 'Veterinario' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data.sort((a, b) => {
        const order = { Administrador: 0, Recepcionista: 1, Veterinario: 2 };
        return (order[a.rol] ?? 3) - (order[b.rol] ?? 3);
      }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    if (!canManage) return;
    setEditingUser(null);
    setForm({ email: '', nombre: '', rol: 'Veterinario' });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    if (!canManage) return;
    if (u.email === OWNER_EMAIL) return; // no se puede editar al propietario
    setEditingUser(u);
    setForm({ email: u.email, nombre: u.nombre, rol: u.rol });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setError('');
    setSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.email || !form.nombre) return setError('El correo y el nombre son obligatorios');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Ingresa un correo electrónico válido');

    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        await updateUserRole(editingUser.id, form.rol);
        setSuccess(`Rol de ${form.nombre} actualizado a ${form.rol}`);
      } else {
        // Verificar si el correo ya existe
        const existing = users.find(u => u.email.toLowerCase() === form.email.toLowerCase().trim());
        if (existing) {
          setError(`El correo ${form.email} ya tiene un rol asignado (${existing.rol})`);
          setSaving(false);
          return;
        }
        await addUserRole({ email: form.email, nombre: form.nombre, rol: form.rol });
        setSuccess(`${form.nombre} registrado como ${form.rol} exitosamente`);
      }
      await loadUsers();
      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error(err);
      setError('Error al guardar el usuario. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!canManage) return;
    if (u.email === OWNER_EMAIL) return alert('No se puede eliminar al propietario del sistema.');
    if (u.email?.toLowerCase() === currentUserEmail?.toLowerCase()) return alert('No puedes eliminarte a ti mismo mientras tienes la sesión activa.');
    if (!window.confirm(`¿Eliminar el acceso de ${u.nombre} (${u.email})?`)) return;
    try {
      await deleteUserRole(u.id);
      await loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const getRolInfo = (rol) => ROLES.find(r => r.value === rol) || ROLES[1];

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', fontSize: '1.25rem' }}>Personal y Roles del Sistema</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {users.length} personas con acceso al sistema
          </p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={18}/> Agregar Persona
          </button>
        )}
      </div>

      {/* Leyenda de roles */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-muted)', padding: '0.4rem 0.9rem', borderRadius: '12px', fontSize: '0.78rem', border: '1px solid var(--border-color)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }}/>
            <span style={{ fontWeight: '600' }}>{r.label}:</span>
            <span style={{ color: 'var(--text-muted)' }}>{r.desc}</span>
          </div>
        ))}
      </div>

      {/* Grid de tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
        
        {/* Tarjeta del propietario (siempre primero, protegida) */}
        <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.3)', position: 'relative', background: 'rgba(239, 68, 68, 0.03)' }}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem' }} title="Propietario supremo — no editable">
            <Shield size={16} color="#ef4444" />
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <User size={20}/>
            </div>
            <div>
              <h4 style={{ fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>{OWNER_NAME}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{OWNER_EMAIL}</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Propietario del Sistema</span>
            <span className="badge badge-danger">Administrador</span>
          </div>
        </div>

        {/* Resto de usuarios de Firestore */}
        {users.filter(u => u.email !== OWNER_EMAIL).map(u => {
          const rolInfo = getRolInfo(u.rol);
          const isCurrentUser = u.email?.toLowerCase() === currentUserEmail?.toLowerCase();
          return (
            <div key={u.id} className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '6px' }}>
                {canManage && !isCurrentUser && (
                  <>
                    <button
                      onClick={() => openEdit(u)}
                      className="btn-ghost"
                      style={{ padding: '4px 6px', border: 'none', background: 'var(--surface-muted)', borderRadius: '7px', color: 'var(--text-muted)' }}
                      title="Cambiar rol"
                    >
                      <Edit3 size={13}/>
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="btn-ghost"
                      style={{ padding: '4px 6px', border: 'none', background: 'rgba(239,68,68,0.08)', borderRadius: '7px', color: '#ef4444' }}
                      title="Revocar acceso"
                    >
                      <Trash2 size={13}/>
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', paddingRight: '4rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `${rolInfo.color}18`, color: rolInfo.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <User size={20}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ fontWeight: '700', fontSize: '0.95rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre}</h4>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rol de acceso</span>
                <span className={`badge ${rolBadgeClass[u.rol] || 'badge-info'}`}>{u.rol}</span>
              </div>
            </div>
          );
        })}

        {/* Estado vacío */}
        {users.filter(u => u.email !== OWNER_EMAIL).length === 0 && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            <Shield size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }}/>
            <p style={{ fontSize: '0.9rem' }}>Aún no hay personal registrado. Agrega a alguien con el botón de arriba.</p>
          </div>
        )}
      </div>

      {/* Modal Agregar / Editar */}
      {showModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={closeModal}>
          <div className="modal-panel" style={{ padding: '2.5rem', width: '480px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal}><X size={20}/></button>
            <h3 style={{ fontWeight: '800', fontSize: '1.2rem', marginBottom: '0.4rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Shield size={20} color="var(--primary)"/>
              {editingUser ? 'Editar Rol de Acceso' : 'Agregar Persona al Sistema'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              {editingUser
                ? 'Puedes cambiar el rol de acceso de esta persona.'
                : 'Ingresa el correo de Google con el que iniciará sesión y asígnale un rol.'}
            </p>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.75rem', color: '#ef4444', fontSize: '0.83rem', marginBottom: '1.25rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '0.75rem', color: '#10b981', fontSize: '0.83rem', marginBottom: '1.25rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <CheckCircle size={15}/> {success}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Nombre Completo *</label>
                <input
                  className="form-input"
                  placeholder="Ej. Dra. María Pérez"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  disabled={!!editingUser}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13}/> Correo de Google (Gmail) *
                </label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="ejemplo@gmail.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  disabled={!!editingUser}
                />
                {!editingUser && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Este correo debe coincidir exactamente con el que usa para iniciar sesión con Google.
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">Rol del Sistema *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem' }}>
                  {ROLES.map(r => (
                    <label
                      key={r.value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                        padding: '0.85rem 1rem', borderRadius: '10px', cursor: 'pointer',
                        border: `1px solid ${form.rol === r.value ? r.color + '60' : 'var(--border-color)'}`,
                        background: form.rol === r.value ? `${r.color}0d` : 'var(--surface-muted)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="radio"
                        name="rol"
                        value={r.value}
                        checked={form.rol === r.value}
                        onChange={() => setForm({ ...form, rol: r.value })}
                        style={{ accentColor: r.color }}
                      />
                      <div>
                        <p style={{ fontWeight: '700', margin: 0, fontSize: '0.9rem', color: form.rol === r.value ? r.color : 'var(--text-main)' }}>{r.label}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingUser ? 'Actualizar Rol' : 'Agregar al Sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
