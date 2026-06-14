import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, TrendingDown, Plus, Minus, Edit3, Trash2, X, Search, AlertTriangle, ChevronDown } from 'lucide-react';
import { getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } from '../services/db';

const CATEGORIAS = ['Medicamentos', 'Vacunas', 'Insumos', 'Productos'];
const FILTRO_CATEGORIAS = ['Todos', ...CATEGORIAS];

// Normaliza la categoría para comparar sin importar mayúsculas/minúsculas ni tildes
const normalizeCategoria = (cat) => (cat || '').trim().toLowerCase();

const autoCategorize = (name) => {
  const n = (name || '').toLowerCase();
  if (
    n.includes('vacuna') || 
    n.includes('triple') || 
    n.includes('antirrábica') || 
    n.includes('antirrabica') || 
    n.includes('séxtuple') || 
    n.includes('sextuple') || 
    n.includes('leucemia') ||
    n.includes('refuerzo') ||
    n.includes('parvovirus') ||
    n.includes('distemper')
  ) {
    return 'Vacunas';
  }
  if (
    n.includes('gasa') || 
    n.includes('jeringa') || 
    n.includes('venda') || 
    n.includes('algodón') || 
    n.includes('algodon') || 
    n.includes('guante') || 
    n.includes('alcohol') || 
    n.includes('jabón') || 
    n.includes('jabon') || 
    n.includes('shampoo') || 
    n.includes('cepillo') || 
    n.includes('bisturí') || 
    n.includes('bisturi') || 
    n.includes('sutura') || 
    n.includes('esparadrapo') || 
    n.includes('suero') || 
    n.includes('catéter') || 
    n.includes('cateter') || 
    n.includes('tubo') ||
    n.includes('jeringuilla') ||
    n.includes('aguja') ||
    n.includes('mascarilla') ||
    n.includes('desinfectante')
  ) {
    return 'Insumos';
  }
  if (
    n.includes('alimento') || 
    n.includes('comida') || 
    n.includes('croqueta') || 
    n.includes('concentrado') || 
    n.includes('renal') || 
    n.includes('lata') || 
    n.includes('juguete') || 
    n.includes('arena') || 
    n.includes('plato') || 
    n.includes('bocadillo') || 
    n.includes('premio') || 
    n.includes('snack') || 
    n.includes('collar') || 
    n.includes('correa') || 
    n.includes('cama') || 
    n.includes('ropa') ||
    n.includes('hueso') ||
    n.includes('pechera') ||
    n.includes('bozal') ||
    n.includes('transportadora')
  ) {
    return 'Productos';
  }
  if (
    n.includes('amoxicilina') || 
    n.includes('ivermectina') || 
    n.includes('meloxicam') || 
    n.includes('cefalexina') || 
    n.includes('pipeta') || 
    n.includes('antipulgas') || 
    n.includes('pastilla') || 
    n.includes('jarabe') || 
    n.includes('gotas') || 
    n.includes('inyectables') || 
    n.includes('suspension') || 
    n.includes('suspensión') || 
    n.includes('tableta') || 
    n.includes('mg') || 
    n.includes('ml') || 
    n.includes('antibiótico') || 
    n.includes('antibiotico') || 
    n.includes('antiinflamatorio') || 
    n.includes('crema') || 
    n.includes('pomada') || 
    n.includes('gel') || 
    n.includes('cápsula') || 
    n.includes('capsula') || 
    n.includes('vitamina') ||
    n.includes('antiparasitario') ||
    n.includes('antidesparasitario') ||
    n.includes('desparasitante') ||
    n.includes('omeprazol') ||
    n.includes('prednisolona') ||
    n.includes('doxiciclina') ||
    n.includes('enrofloxacina') ||
    n.includes('analgésico') ||
    n.includes('analgesico')
  ) {
    return 'Medicamentos';
  }
  return '';
};

const CAT_COLORS = {
  Medicamentos: { bg: 'rgba(14,165,233,0.1)', text: '#0ea5e9', border: 'rgba(14,165,233,0.25)' },
  Vacunas:      { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
  Insumos:      { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  Productos:    { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
};

const getCatColor = (cat) => {
  const found = Object.keys(CAT_COLORS).find(k => normalizeCategoria(k) === normalizeCategoria(cat));
  return found ? CAT_COLORS[found] : { bg: 'rgba(99,102,241,0.1)', text: '#6366f1', border: 'rgba(99,102,241,0.25)' };
};

export default function Inventario({ userRole }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [form, setForm] = useState({ producto: '', stock: '', minimo: '', precio: '', categoria: 'Medicamentos' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getInventory();
      setItems(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ajustarStock = async (id, delta) => {
    try {
      const item = items.find(i => i.id === id);
      const newStock = Math.max(0, item.stock + delta);
      setItems(prev => prev.map(i => i.id === id ? { ...i, stock: newStock } : i));
      await updateInventoryItem(id, { stock: newStock });
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setForm({
      producto: item.producto,
      stock: item.stock,
      minimo: item.minimo,
      precio: item.precio,
      // Normalizar la categoría al abrir el modal de edición
      categoria: CATEGORIAS.find(c => normalizeCategoria(c) === normalizeCategoria(item.categoria)) || 'Medicamentos'
    });
    setShowModal(true);
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto del inventario?')) return;
    try {
      await deleteInventoryItem(id);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!form.producto || form.stock === '' || form.minimo === '' || form.precio === '') {
      return alert('Todos los campos son obligatorios');
    }
    setSaving(true);
    try {
      const body = {
        producto: form.producto,
        stock: parseInt(form.stock),
        minimo: parseInt(form.minimo),
        precio: parseFloat(form.precio),
        categoria: form.categoria
      };
      if (editingId) {
        await updateInventoryItem(editingId, body);
      } else {
        await addInventoryItem(body);
      }
      await load();
      closeModal();
    } catch (e) {
      console.error(e);
      alert('Error al guardar producto');
    }
    setSaving(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ producto: '', stock: '', minimo: '', precio: '', categoria: 'Medicamentos' });
  };

  const getStatus = (stock, minimo) => {
    if (stock === 0) return { label: 'Sin Stock', cls: 'badge-danger', pct: 0, color: '#ef4444' };
    if (stock <= minimo) return { label: 'Stock Bajo', cls: 'badge-warning', pct: Math.min((stock / minimo) * 50, 50), color: '#f59e0b' };
    return { label: 'OK', cls: 'badge-success', pct: 100, color: '#10b981' };
  };

  // Filtrado con normalización para evitar bugs de mayúsculas/minúsculas
  const filteredItems = items.filter(item => {
    const matchesSearch =
      (item.producto || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.categoria || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === 'Todos' ||
      normalizeCategoria(item.categoria) === normalizeCategoria(selectedCategory);
    return matchesSearch && matchesCat;
  });

  const canManageInventory = userRole === 'Administrador' || userRole === 'Recepcionista';
  const bajosDeStock = items.filter(i => i.stock <= i.minimo).length;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>

      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', fontSize: '1.25rem' }}>Gestión de Inventario</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {items.length} productos · {bajosDeStock} con alerta de stock
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {bajosDeStock > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: '600', display: 'flex', gap: '0.5rem', alignItems: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
              <TrendingDown size={15}/> {bajosDeStock} bajo mínimo
            </div>
          )}
          {canManageInventory && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18}/> Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
        {/* Pills de categoría */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {FILTRO_CATEGORIAS.map(f => (
            <button
              key={f}
              onClick={() => setSelectedCategory(f)}
              className={`filter-pill${selectedCategory === f ? ' active' : ''}`}
            >
              {f}
              {f !== 'Todos' && (
                <span style={{ marginLeft: '6px', background: selectedCategory === f ? 'rgba(255,255,255,0.25)' : 'var(--surface-muted)', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: '700' }}>
                  {items.filter(i => normalizeCategoria(i.categoria) === normalizeCategoria(f)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="glass-card" style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '240px' }}>
          <Search size={15} color="var(--text-muted)"/>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar producto..."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-main)', width: '100%' }}
          />
        </div>
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: '3rem 0', textAlign: 'center' }}>Cargando inventario...</p>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <Package size={40} style={{ marginBottom: '1rem', opacity: 0.3 }}/>
          <p style={{ fontSize: '0.9rem' }}>No hay productos en esta categoría.</p>
          {canManageInventory && <p style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Usa "Nuevo Producto" para agregar uno.</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {filteredItems.map(item => {
            const st = getStatus(item.stock, item.minimo);
            const catColor = getCatColor(item.categoria);
            return (
              <div
                key={item.id}
                className="glass-card"
                style={{ padding: '1.4rem', borderLeft: `4px solid ${st.color}`, position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
              >
                {/* Botones acción */}
                {canManageInventory && (
                  <div style={{ position: 'absolute', top: '0.9rem', right: '0.9rem', display: 'flex', gap: '6px' }}>
                    <button onClick={() => handleEditClick(item)} className="btn-ghost" style={{ padding: '4px 6px', background: 'var(--surface-muted)', borderRadius: '7px', border: 'none', color: 'var(--text-muted)' }} title="Editar">
                      <Edit3 size={13}/>
                    </button>
                    <button onClick={() => handleDeleteClick(item.id)} className="btn-ghost" style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: '7px', border: 'none', color: '#ef4444' }} title="Eliminar">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                )}

                {/* Categoría + Nombre */}
                <div style={{ paddingRight: canManageInventory ? '4rem' : '0' }}>
                  <span style={{ background: catColor.bg, color: catColor.text, border: `1px solid ${catColor.border}`, padding: '2px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
                    <Package size={11}/> {item.categoria || 'General'}
                  </span>
                  <h4 style={{ fontWeight: '700', fontSize: '1rem', margin: 0, color: 'var(--text-main)', lineHeight: 1.3 }}>{item.producto}</h4>
                </div>

                {/* Badge de estado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${st.cls}`} style={{ fontSize: '0.75rem' }}>{st.label}</span>
                  {st.label !== 'OK' && <AlertTriangle size={13} color={st.color}/>}
                </div>

                {/* Barra de stock */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>NIVEL DE STOCK</span>
                    <span>Mín: {item.minimo} uds</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--surface-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(st.pct, 100)}%`, background: st.color, borderRadius: '4px', transition: 'width 0.4s ease-out' }}/>
                  </div>
                </div>

                {/* Precio + Controles de stock */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>PRECIO UNIT.</p>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>L {Number(item.precio || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-muted)', padding: '4px', borderRadius: '10px' }}>
                    <button onClick={() => ajustarStock(item.id, -1)} className="btn-ghost" style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center', background: 'var(--surface-color)', borderRadius: '7px' }}>
                      <Minus size={15}/>
                    </button>
                    <span style={{ fontWeight: '800', fontSize: '1.2rem', minWidth: '34px', textAlign: 'center', color: st.color }}>{item.stock}</span>
                    <button onClick={() => ajustarStock(item.id, 1)} style={{ width: '32px', height: '32px', borderRadius: '7px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <Plus size={15}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Agregar/Editar ── */}
      {showModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={closeModal}>
          <div className="modal-panel" style={{ padding: '2.5rem', width: '480px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal}><X size={20}/></button>
            <h3 style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto / Insumo'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Nombre del Producto *</label>
                <input 
                  className="form-input" 
                  placeholder="Ej. Amoxicilina 500mg, Gasa, etc." 
                  value={form.producto} 
                  onChange={e => {
                    const name = e.target.value;
                    const detectedCat = autoCategorize(name);
                    setForm(prev => ({
                      ...prev,
                      producto: name,
                      categoria: detectedCat || prev.categoria
                    }));
                  }}
                />
              </div>

              <div>
                <label className="form-label">Categoría</label>
                <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Stock Inicial *</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}/>
                </div>
                <div>
                  <label className="form-label">Stock Mínimo *</label>
                  <input className="form-input" type="number" min="1" placeholder="5" value={form.minimo} onChange={e => setForm({ ...form, minimo: e.target.value })}/>
                </div>
              </div>

              <div>
                <label className="form-label">Precio Unitario (L) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })}/>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.25rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
