import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Download, X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getInvoices, updateInvoice } from '../services/db';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Formato Lempiras hondureños
const fmtLPS = (n) => `L ${Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Formato visual ID
const fmtId = (id) => `FAC-${String(id).slice(-5).toUpperCase()}`;

export default function Facturas({ userRole }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Modal de pago
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payForm, setPayForm] = useState({ metodo_pago: 'Efectivo' });
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadData = async () => {
    try {
      const invs = await getInvoices();
      setInvoices(invs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRegisterPayment = async () => {
    setSaving(true);
    try {
      await updateInvoice(selectedInvoice.id, {
        estado: 'Pagada',
        metodo_pago: payForm.metodo_pago
      });
      await loadData();
      setShowPayModal(false);
      setSelectedInvoice(null);
    } catch (e) {
      console.error(e);
      alert('Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("VET-MIS CLINIC", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Clínica Veterinaria Integral", 14, 28);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`FACTURA RECIBO: ${fmtId(inv.id)}`, pageWidth - 14, 22, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha: ${inv.fecha}`, pageWidth - 14, 28, { align: 'right' });
      
      doc.line(14, 32, pageWidth - 14, 32);
      
      doc.setFont("helvetica", "bold");
      doc.text("Datos del Cliente:", 14, 40);
      doc.setFont("helvetica", "normal");
      doc.text(`Nombre: ${inv.dueno || '—'}`, 18, 46);
      
      doc.setFont("helvetica", "bold");
      doc.text("Datos del Paciente:", pageWidth / 2, 40);
      doc.setFont("helvetica", "normal");
      doc.text(`Paciente: ${inv.paciente || '—'}`, (pageWidth / 2) + 4, 46);
      
      doc.autoTable({
        startY: 55,
        headStyles: { fillColor: [16, 185, 129] },
        head: [['Descripción', 'Precio Unit.', 'Total']],
        body: [
          [inv.servicio || 'Servicios Veterinarios', fmtLPS(inv.total), fmtLPS(inv.total)]
        ],
      });
      
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.text(`Método de Pago: ${inv.metodo_pago || '—'}`, 14, finalY);
      doc.text(`Estado: ${inv.estado.toUpperCase()}`, 14, finalY + 6);
      
      doc.text("Subtotal:", pageWidth - 50, finalY);
      doc.setFont("helvetica", "normal");
      doc.text(fmtLPS(inv.subtotal), pageWidth - 14, finalY, { align: 'right' });
      
      doc.setFont("helvetica", "bold");
      doc.text("ISV (15%):", pageWidth - 50, finalY + 6);
      doc.setFont("helvetica", "normal");
      doc.text(fmtLPS(inv.impuesto), pageWidth - 14, finalY + 6, { align: 'right' });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", pageWidth - 50, finalY + 14);
      doc.text(fmtLPS(inv.total), pageWidth - 14, finalY + 14, { align: 'right' });
      
      doc.save(`factura_${fmtId(inv.id)}.pdf`);
    } catch (e) {
      console.error(e);
      alert('No se pudo generar el PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const filtered = invoices.filter(inv => {
    const matchesSearch =
      (inv.dueno || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.paciente || '').toLowerCase().includes(search.toLowerCase()) ||
      String(inv.id).includes(search) ||
      (inv.servicio || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'Todas' || inv.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // KPIs rápidos
  const totalPagado = invoices.filter(i => i.estado === 'Pagada').reduce((s, i) => s + Number(i.total), 0);
  const totalPendiente = invoices.filter(i => i.estado === 'Pendiente').reduce((s, i) => s + Number(i.total), 0);

  const canManageBilling = userRole === 'Administrador' || userRole === 'Recepcionista';

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', fontSize: '1.25rem' }}>Módulo de Facturación</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{invoices.length} facturas emitidas · Las facturas se generan automáticamente al completar una cita</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Total Cobrado</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{fmtLPS(totalPagado)}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Pendiente de Cobro</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{fmtLPS(totalPendiente)}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Facturas Emitidas</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{invoices.length}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem' }}>Pendientes</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6' }}>{invoices.filter(i => i.estado === 'Pendiente').length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['Todas', 'Pagada', 'Pendiente', 'Cancelada'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`filter-pill${statusFilter === f ? ' active' : ''}`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div className="glass-card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '280px' }}>
          <Search size={16} color="var(--text-muted)"/>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar cliente, mascota o folio..." 
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', color: 'var(--text-main)', width: '100%' }}
          />
        </div>
      </div>

      {/* Tabla de Facturas */}
      <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '850px' }}>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Mascota</th>
              <th>Propietario</th>
              <th>Concepto</th>
              <th>ISV (15%)</th>
              <th>Total</th>
              <th>Medio Pago</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {inv.cita_id ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} style={{ color: 'var(--text-muted)' }}/>
                      {fmtId(inv.id)}
                    </span>
                  ) : (
                    fmtId(inv.id)
                  )}
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.fecha}</td>
                <td style={{ fontWeight: 600 }}>{inv.paciente}</td>
                <td>{inv.dueno}</td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{inv.servicio || 'Servicio Veterinario'}</td>
                <td>{fmtLPS(inv.impuesto)}</td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>{fmtLPS(inv.total)}</td>
                <td>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {inv.estado === 'Pagada' ? inv.metodo_pago : '—'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${inv.estado === 'Pagada' ? 'badge-success' : inv.estado === 'Cancelada' ? 'badge-danger' : 'badge-warning'}`}>
                    {inv.estado}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => downloadPdf(inv)} 
                      disabled={downloadingId === inv.id}
                      className="btn-ghost" 
                      style={{ padding: '4px 8px', fontSize: '0.75rem', height: '32px' }}
                    >
                      <Download size={13}/> PDF
                    </button>
                    {inv.estado === 'Pendiente' && canManageBilling && (
                      <button 
                        onClick={() => { setSelectedInvoice(inv); setShowPayModal(true); }}
                        className="btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', height: '32px', background: '#10b981' }}
                      >
                        Cobrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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

        {filtered.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            {search || statusFilter !== 'Todas' ? 'No hay facturas que coincidan con el filtro.' : 'No hay registros de facturación. Las facturas se crean automáticamente al marcar citas como Completadas.'}
          </p>
        )}
      </div>

      {/* Modal Registrar Pago */}
      {showPayModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={() => setShowPayModal(false)}>
          <div className="modal-panel" style={{ padding: '2rem', width: '420px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowPayModal(false)}><X size={20}/></button>
            <h3 style={{ fontWeight: '800', fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Cobrar Factura</h3>
            
            {/* Detalle de la factura */}
            <div className="surface-inset" style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Folio</p>
                  <p style={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmtId(selectedInvoice?.id || '')}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Paciente</p>
                  <p style={{ fontWeight: 600 }}>{selectedInvoice?.paciente}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Propietario</p>
                  <p>{selectedInvoice?.dueno}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Concepto</p>
                  <p>{selectedInvoice?.servicio || 'Servicio Veterinario'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>ISV (15%)</p>
                  <p>{fmtLPS(selectedInvoice?.impuesto)}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Total a Cobrar</p>
                  <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>{fmtLPS(selectedInvoice?.total)}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="form-label">Método de Pago</label>
              <select className="form-input" value={payForm.metodo_pago} onChange={e => setPayForm({ metodo_pago: e.target.value })}>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowPayModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleRegisterPayment} disabled={saving} style={{ background: '#10b981' }}>
                {saving ? 'Registrando...' : '✓ Confirmar Cobro'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
