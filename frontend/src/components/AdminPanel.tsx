import React, { useEffect, useState } from 'react';
import {
  Users,
  Upload,
  MessageSquare,
  ShieldAlert,
  BarChart3,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  UserPlus,
  FileSpreadsheet,
  Download,
  Database,
  Trash2,
  Eye,
  X,
  Award,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { api, getPdfDownloadUrl } from '../api';

const MESES = [
  { num: 1, nombre: 'Enero' },
  { num: 2, nombre: 'Febrero' },
  { num: 3, nombre: 'Marzo' },
  { num: 4, nombre: 'Abril' },
  { num: 5, nombre: 'Mayo' },
  { num: 6, nombre: 'Junio' },
  { num: 7, nombre: 'Julio' },
  { num: 8, nombre: 'Agosto' },
  { num: 9, nombre: 'Septiembre' },
  { num: 10, nombre: 'Octubre' },
  { num: 11, nombre: 'Noviembre' },
  { num: 12, nombre: 'Diciembre' },
];

export type AdminSubTab = 'dashboard' | 'plantillas' | 'usuarios' | 'mensajes' | 'auditoria';

interface AdminPanelProps {
  activeSubTab?: AdminSubTab;
  onSelectSubTab?: (tab: AdminSubTab) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ activeSubTab, onSelectSubTab }) => {
  const [internalTab, setInternalTab] = useState<AdminSubTab>('dashboard');
  const subTab = activeSubTab || internalTab;

  const cambiarTab = (t: AdminSubTab) => {
    setInternalTab(t);
    if (onSelectSubTab) onSelectSubTab(t);
  };

  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  // Dashboard Stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Plantillas CSV
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [mesCarga, setMesCarga] = useState<number>(9);
  const [anioCarga, setAnioCarga] = useState<number>(2026);
  const [tipoCarga, setTipoCarga] = useState<'P' | 'R'>('P');
  const [archivoCsv, setArchivoCsv] = useState<File | null>(null);
  const [subiendoCsv, setSubiendoCsv] = useState(false);
  const [importandoPeriodo, setImportandoPeriodo] = useState<number | null>(null);

  // Usuarios
  const [usuariosData, setUsuariosData] = useState<{ items: any[]; total: number; page: number; totalPages: number }>({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [searchUsuario, setSearchUsuario] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstadoUsuario, setFiltroEstadoUsuario] = useState('');
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [modalNuevoUsuario, setModalNuevoUsuario] = useState(false);
  const [nuevoUserForm, setNuevoUserForm] = useState({
    rut: '',
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    cargo: '',
    unidad: '',
    rol: 'FUNCIONARIO',
    password: '',
  });
  const [inspectorUsuario, setInspectorUsuario] = useState<any | null>(null);
  const [liqInspector, setLiqInspector] = useState<any[]>([]);
  const [anioInspector, setAnioInspector] = useState<number>(2026);
  const [loadingInspector, setLoadingInspector] = useState(false);

  // Mensajes RRHH
  const [mensajesData, setMensajesData] = useState<{ items: any[]; total: number; page: number; totalPages: number }>({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [filtroEstadoMensaje, setFiltroEstadoMensaje] = useState('PENDIENTE');
  const [searchMensaje, setSearchMensaje] = useState('');
  const [loadingMensajes, setLoadingMensajes] = useState(false);

  // Auditoría
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [filtroAccionAudit, setFiltroAccionAudit] = useState('TODAS');
  const [searchAudit, setSearchAudit] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);

  const mostrarFeedback = (tipo: 'ok' | 'err', texto: string) => {
    setFeedback({ tipo, texto });
    setTimeout(() => setFeedback(null), 6000);
  };

  const cargarStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch (e: any) {
      mostrarFeedback('err', e.response?.data?.error || 'Error cargando estadísticas.');
    } finally {
      setLoadingStats(false);
    }
  };

  const cargarPlantillas = async () => {
    setLoadingPlantillas(true);
    try {
      const { data } = await api.get('/admin/plantillas');
      setPlantillas(data);
    } catch (e: any) {
      mostrarFeedback('err', e.response?.data?.error || 'Error cargando historial de plantillas.');
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const cargarUsuarios = async (page = 1) => {
    setLoadingUsuarios(true);
    try {
      const { data } = await api.get('/admin/usuarios', {
        params: {
          page,
          limit: 20,
          search: searchUsuario,
          rol: filtroRol,
          estado: filtroEstadoUsuario,
        },
      });
      setUsuariosData(data);
    } catch (e: any) {
      mostrarFeedback('err', e.response?.data?.error || 'Error cargando nómina de usuarios.');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const cargarMensajes = async (page = 1) => {
    setLoadingMensajes(true);
    try {
      const { data } = await api.get('/admin/mensajes', {
        params: {
          page,
          limit: 20,
          estado: filtroEstadoMensaje,
          search: searchMensaje,
        },
      });
      setMensajesData(data);
    } catch (e: any) {
      mostrarFeedback('err', e.response?.data?.error || 'Error cargando bandeja de mensajes.');
    } finally {
      setLoadingMensajes(false);
    }
  };

  const cargarAuditoria = async () => {
    setLoadingAudit(true);
    try {
      const { data } = await api.get('/admin/auditoria', {
        params: {
          accion: filtroAccionAudit,
          search: searchAudit,
          limit: 80,
        },
      });
      setAuditoria(data);
    } catch (e: any) {
      mostrarFeedback('err', e.response?.data?.error || 'Error cargando registros de auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (subTab === 'dashboard') cargarStats();
    if (subTab === 'plantillas') cargarPlantillas();
    if (subTab === 'usuarios') cargarUsuarios(1);
    if (subTab === 'mensajes') cargarMensajes(1);
    if (subTab === 'auditoria') cargarAuditoria();
  }, [subTab]);

  const handleSubirPlantilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoCsv) {
      mostrarFeedback('err', 'Seleccione un archivo CSV para cargar.');
      return;
    }

    setSubiendoCsv(true);
    try {
      const valRes = await api.post('/admin/plantillas/validar', {
        mes: mesCarga,
        anio: anioCarga,
        tipo: tipoCarga,
      });

      if (valRes.data.existe) {
        const confirmar = window.confirm(
          `El período ${valRes.data.periodoFmt} ya registra datos cargados para ${
            tipoCarga === 'P' ? 'Personal' : 'Renta'
          }. ¿Desea reemplazar la carga existente?`
        );
        if (!confirmar) {
          setSubiendoCsv(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('archivo', archivoCsv);
      formData.append('mes', String(mesCarga));
      formData.append('anio', String(anioCarga));
      formData.append('tipo', tipoCarga);

      const { data } = await api.post('/admin/plantillas/cargar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      mostrarFeedback('ok', data.mensaje);
      setArchivoCsv(null);
      cargarPlantillas();
    } catch (err: any) {
      mostrarFeedback('err', err.response?.data?.error || 'Error al procesar el archivo CSV.');
    } finally {
      setSubiendoCsv(false);
    }
  };

  const handleImportarRespaldo = async (periodo: number, periodoFmt: string) => {
    setImportandoPeriodo(periodo);
    try {
      const { data } = await api.post(`/admin/plantillas/${periodo}/importar-respaldo`);
      mostrarFeedback('ok', data.mensaje || `Período ${periodoFmt} importado con éxito.`);
      cargarPlantillas();
    } catch (err: any) {
      mostrarFeedback('err', err.response?.data?.error || 'Error importando desde respaldo.');
    } finally {
      setImportandoPeriodo(null);
    }
  };

  const handleEliminarCarga = async (periodo: number, periodoFmt: string) => {
    if (!window.confirm(`¿Está seguro de vaciar las liquidaciones en PostgreSQL del período ${periodoFmt}?`)) {
      return;
    }
    try {
      const { data } = await api.delete(`/admin/plantillas/${periodo}`);
      mostrarFeedback('ok', data.mensaje);
      cargarPlantillas();
    } catch (err: any) {
      mostrarFeedback('err', err.response?.data?.error || 'Error eliminando período.');
    }
  };

  const handleAccionUsuario = async (rut: number, payload: any) => {
    try {
      const { data } = await api.patch(`/admin/usuarios/${rut}`, payload);
      mostrarFeedback('ok', data.mensaje);
      cargarUsuarios(usuariosData.page);
    } catch (err: any) {
      mostrarFeedback('err', err.response?.data?.error || 'Error actualizando funcionario.');
    }
  };

  const handleGuardarNuevoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/admin/usuarios', nuevoUserForm);
      mostrarFeedback('ok', data.mensaje);
      setModalNuevoUsuario(false);
      setNuevoUserForm({
        rut: '',
        nombres: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        email: '',
        cargo: '',
        unidad: '',
        rol: 'FUNCIONARIO',
        password: '',
      });
      cargarUsuarios(1);
    } catch (err: any) {
      mostrarFeedback('err', err.response?.data?.error || 'Error creando/editando usuario.');
    }
  };

  const abrirInspectorLiquidaciones = async (u: any) => {
    setInspectorUsuario(u);
    setAnioInspector(2026);
    setLoadingInspector(true);
    try {
      const { data } = await api.get('/liquidaciones', { params: { rut: u.rut } });
      setLiqInspector(data);
    } catch {
      setLiqInspector([]);
    } finally {
      setLoadingInspector(false);
    }
  };

  const handleCambiarEstadoMensaje = async (id: number, nuevoEstado: 'LEIDO' | 'PENDIENTE') => {
    try {
      await api.patch(`/admin/mensajes/${id}`, { estado: nuevoEstado });
      cargarMensajes(mensajesData.page);
    } catch (err: any) {
      mostrarFeedback('err', err.response?.data?.error || 'Error actualizando mensaje.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Navegación Interna de Administración */}
      <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-2 flex flex-wrap gap-2">
        <button
          onClick={() => cambiarTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            subTab === 'dashboard'
              ? 'bg-[#016098] text-white shadow-sm'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Dashboard RRHH
        </button>

        <button
          onClick={() => cambiarTab('plantillas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            subTab === 'plantillas'
              ? 'bg-[#016098] text-white shadow-sm'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Gestión de Plantillas CSV
        </button>

        <button
          onClick={() => cambiarTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            subTab === 'usuarios'
              ? 'bg-[#016098] text-white shadow-sm'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
          }`}
        >
          <Users className="w-4 h-4" />
          Mantenedor de Usuarios
        </button>

        <button
          onClick={() => cambiarTab('mensajes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            subTab === 'mensajes'
              ? 'bg-[#016098] text-white shadow-sm'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Bandeja de Consultas RRHH
          {stats?.mensajes?.pendientes > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
              {stats.mensajes.pendientes}
            </span>
          )}
        </button>

        <button
          onClick={() => cambiarTab('auditoria')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
            subTab === 'auditoria'
              ? 'bg-[#016098] text-white shadow-sm'
              : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Auditoría de Accesos
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.tipo === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            {feedback.tipo === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.texto}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. DASHBOARD RESUMEN */}
      {subTab === 'dashboard' && (
        <div className="space-y-6">
          {loadingStats || !stats ? (
            <div className="bg-white rounded-xl p-12 text-center text-slate-500 border border-[#e2e8f0]">
              Cargando indicadores de Recursos Humanos...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-[#016098] flex items-center gap-4">
                  <div className="bg-[#e0f2fe] p-3.5 rounded-full flex shrink-0">
                    <Users className="w-7 h-7 text-[#016098]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Funcionarios Registrados
                    </p>
                    <p className="text-2xl font-black text-gray-800 leading-tight mt-0.5">
                      {stats.usuarios.total.toLocaleString('es-CL')}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {stats.usuarios.admins} Admins · {stats.usuarios.nuevos.toLocaleString('es-CL')} nuevos
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-green-500 flex items-center gap-4">
                  <div className="bg-green-100 p-3.5 rounded-full flex shrink-0">
                    <FileSpreadsheet className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Último Período Activo
                    </p>
                    <p className="text-2xl font-black text-gray-800 leading-tight mt-0.5">
                      {stats.procesos.ultimoPeriodo?.periodoFmt || 'Sin carga'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {stats.procesos.ultimoPeriodo?.filasPersonal?.toLocaleString('es-CL') || 0} liquidaciones
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-[#39BABD] flex items-center gap-4">
                  <div className="bg-cyan-50 p-3.5 rounded-full flex shrink-0">
                    <Database className="w-7 h-7 text-[#39BABD]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Períodos Históricos
                    </p>
                    <p className="text-2xl font-black text-gray-800 leading-tight mt-0.5">
                      {stats.procesos.totalPeriodos}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {stats.procesos.totalLiquidacionesEnDb.toLocaleString('es-CL')} fichas en PostgreSQL
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-amber-500 flex items-center gap-4">
                  <div className="bg-amber-100 p-3.5 rounded-full flex shrink-0">
                    <MessageSquare className="w-7 h-7 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Consultas RRHH
                    </p>
                    <p className="text-2xl font-black text-gray-800 leading-tight mt-0.5">
                      {stats.mensajes.pendientes.toLocaleString('es-CL')}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Pendientes ({stats.mensajes.totales.toLocaleString('es-CL')} totales)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                  <h3 className="font-bold text-[#016098]">Actividad Reciente del Portal</h3>
                  <button
                    onClick={cargarStats}
                    className="text-xs text-[#016098] font-semibold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#f8fafc] text-gray-500 text-xs uppercase border-b border-[#e2e8f0]">
                      <tr>
                        <th className="px-4 py-3">Fecha / Hora</th>
                        <th className="px-4 py-3">Acción</th>
                        <th className="px-4 py-3">Funcionario</th>
                        <th className="px-4 py-3">Rol</th>
                        <th className="px-4 py-3">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(stats.ultimosEventos || []).map((ev: any) => (
                        <tr key={ev.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                            {new Date(ev.fecha).toLocaleString('es-CL')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#016098] text-xs">{ev.accion}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900">{ev.rutUsuario}</span>{' '}
                            <span className="text-slate-500 text-xs">{ev.nombreUsuario}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded bg-[#e0f2fe] text-[#016098] font-semibold">
                              {ev.rolUsuario}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{ev.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. GESTIÓN DE PLANTILLAS CSV */}
      {subTab === 'plantillas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6">
            <h3 className="text-lg font-bold text-[#016098] mb-1 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#016098]" />
              Cargar Nueva Plantilla Mensual de Remuneraciones (CSV)
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Suba los archivos separados por punto y coma (<code className="bg-slate-100 px-1.5 py-0.5 rounded">;</code>) exportados desde el sistema de remuneraciones: <strong>Personal</strong> (68 columnas) y <strong>Renta</strong> (14 columnas). Los nuevos funcionarios se habilitarán automáticamente.
            </p>

            <form onSubmit={handleSubirPlantilla} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                  Mes de Proceso
                </label>
                <select
                  value={mesCarga}
                  onChange={(e) => setMesCarga(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#016098] focus:outline-none"
                >
                  {MESES.map((m) => (
                    <option key={m.num} value={m.num}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                  Año de Proceso
                </label>
                <select
                  value={anioCarga}
                  onChange={(e) => setAnioCarga(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#016098] focus:outline-none"
                >
                  {[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                  Tipo de Plantilla
                </label>
                <select
                  value={tipoCarga}
                  onChange={(e) => setTipoCarga(e.target.value as 'P' | 'R')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#016098] focus:outline-none"
                >
                  <option value="P">Personal (68 columnas - Encabezado)</option>
                  <option value="R">Renta (14 columnas - Haberes y Desctos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                  Archivo CSV (.csv)
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setArchivoCsv(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#e0f2fe] file:text-[#016098] hover:file:bg-blue-100"
                />
              </div>

              <div className="md:col-span-4 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={subiendoCsv || !archivoCsv}
                  className="bg-[#016098] hover:bg-[#024a8d] disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-sm transition"
                >
                  <Upload className="w-4 h-4" />
                  {subiendoCsv ? 'Procesando e insertando registros en PostgreSQL...' : 'Procesar y Publicar Plantilla'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#016098]">
                  Historial de Períodos de Remuneraciones ({plantillas.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Los períodos históricos pueden importarse desde el respaldo del servidor a PostgreSQL con un clic.
                </p>
              </div>
              <button
                onClick={cargarPlantillas}
                className="text-xs text-[#016098] font-semibold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
            </div>

            {loadingPlantillas ? (
              <div className="p-10 text-center text-slate-500">Cargando períodos...</div>
            ) : (
              <div className="overflow-x-auto max-h-[540px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8fafc] text-gray-500 text-xs uppercase sticky top-0 border-b border-[#e2e8f0]">
                    <tr>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3">Archivo Personal</th>
                      <th className="px-4 py-3">Archivo Renta</th>
                      <th className="px-4 py-3 text-right">Fichas Personal</th>
                      <th className="px-4 py-3 text-right">Ítems Renta</th>
                      <th className="px-4 py-3">Estado en PostgreSQL</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plantillas.map((p) => (
                      <tr key={p.periodo} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-[#016098] whitespace-nowrap">
                          {p.periodoFmt}{' '}
                          <span className="text-xs font-normal text-slate-400">({p.periodo})</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{p.nomArchPersonal || '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{p.nomArchRenta || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {p.filasPersonal > 0 ? p.filasPersonal.toLocaleString('es-CL') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {p.filasRenta > 0 ? p.filasRenta.toLocaleString('es-CL') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {p.filasPersonal > 0 && p.filasRenta > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Activo en DB
                            </span>
                          ) : p.filasPersonal > 0 || p.filasRenta > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              Carga Parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              En Respaldo CSV
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          {p.respaldoDisponible && (p.filasPersonal === 0 || p.filasRenta === 0) && (
                            <button
                              onClick={() => handleImportarRespaldo(p.periodo, p.periodoFmt)}
                              disabled={importandoPeriodo === p.periodo}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#e0f2fe] text-[#016098] hover:bg-blue-100 disabled:opacity-50"
                            >
                              <Database className="w-3.5 h-3.5" />
                              {importandoPeriodo === p.periodo ? 'Importando...' : 'Cargar desde Respaldo'}
                            </button>
                          )}
                          {(p.filasPersonal > 0 || p.filasRenta > 0) && (
                            <button
                              onClick={() => handleEliminarCarga(p.periodo, p.periodoFmt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
                              title="Vaciar registros de este período"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MANTENEDOR DE USUARIOS */}
      {subTab === 'usuarios' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchUsuario}
                  onChange={(e) => setSearchUsuario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && cargarUsuarios(1)}
                  placeholder="Buscar por RUT, nombre, establecimiento o cargo..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#016098] focus:outline-none"
                />
              </div>

              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos los roles</option>
                <option value="ADMIN">Administradores</option>
                <option value="FUNCIONARIO">Funcionarios</option>
              </select>

              <select
                value={filtroEstadoUsuario}
                onChange={(e) => setFiltroEstadoUsuario(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVO">Activos</option>
                <option value="BLOQUEADO">Bloqueados</option>
                <option value="NUEVO">Con Clave Inicial (Nuevos)</option>
              </select>

              <button
                onClick={() => cargarUsuarios(1)}
                className="bg-[#016098] hover:bg-[#024a8d] text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Filtrar
              </button>
            </div>

            <button
              onClick={() => setModalNuevoUsuario(true)}
              className="bg-[#39BABD] hover:bg-[#2c989b] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo / Editar Funcionario
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between text-xs text-slate-600">
              <span>
                Mostrando página {usuariosData.page} de {usuariosData.totalPages} (
                <strong>{usuariosData.total.toLocaleString('es-CL')}</strong> usuarios encontrados)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={usuariosData.page <= 1}
                  onClick={() => cargarUsuarios(usuariosData.page - 1)}
                  className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={usuariosData.page >= usuariosData.totalPages}
                  onClick={() => cargarUsuarios(usuariosData.page + 1)}
                  className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>

            {loadingUsuarios ? (
              <div className="p-10 text-center text-slate-500">Consultando funcionarios...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8fafc] text-gray-500 text-xs uppercase border-b border-[#e2e8f0]">
                    <tr>
                      <th className="px-4 py-3">RUT</th>
                      <th className="px-4 py-3">Funcionario</th>
                      <th className="px-4 py-3">Unidad / Cargo</th>
                      <th className="px-4 py-3">Rol</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones Administrativas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuariosData.items.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-[#016098] whitespace-nowrap">
                          {u.rutFmt}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{u.nombreCompleto}</div>
                          {u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="font-medium text-slate-800">{u.unidad || '-'}</div>
                          <div>{u.cargo || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          {u.rol === 'ADMIN' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e0f2fe] text-[#016098]">
                              ADMIN
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              FUNCIONARIO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.bloqueado ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              Bloqueado
                            </span>
                          ) : u.esNuevo ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              Clave Inicial ({String(u.rut).slice(-4)})
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              Activo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            onClick={() => abrirInspectorLiquidaciones(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#e0f2fe] text-[#016098] hover:bg-blue-100"
                            title="Ver y descargar liquidaciones o certificado de antigüedad de este funcionario"
                          >
                            <Eye className="w-3.5 h-3.5" /> Documentos
                          </button>

                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Restablecer la contraseña de ${u.nombreCompleto} (${u.rutFmt}) a los últimos 4 dígitos de su RUT (${String(
                                    u.rut
                                  ).slice(-4)})?`
                                )
                              ) {
                                handleAccionUsuario(u.rut, { resetPassword: true });
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100"
                            title="Restablecer clave a últimos 4 dígitos del RUT"
                          >
                            <KeyRound className="w-3.5 h-3.5" /> Reset Clave
                          </button>

                          <button
                            onClick={() =>
                              handleAccionUsuario(u.rut, { bloqueado: !u.bloqueado })
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                              u.bloqueado
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                            title={u.bloqueado ? 'Desbloquear cuenta' : 'Bloquear cuenta'}
                          >
                            {u.bloqueado ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" /> Desbloquear
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" /> Bloquear
                              </>
                            )}
                          </button>

                          <button
                            onClick={() =>
                              handleAccionUsuario(u.rut, {
                                rol: u.rol === 'ADMIN' ? 'FUNCIONARIO' : 'ADMIN',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                            title="Cambiar rol Admin / Funcionario"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {u.rol === 'ADMIN' ? 'Quitar Admin' : 'Hacer Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. BANDEJA DE CONSULTAS RRHH */}
      {subTab === 'mensajes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchMensaje}
                  onChange={(e) => setSearchMensaje(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && cargarMensajes(1)}
                  placeholder="Buscar por RUT, funcionario, correo o texto del mensaje..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm"
                />
              </div>

              <select
                value={filtroEstadoMensaje}
                onChange={(e) => setFiltroEstadoMensaje(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="PENDIENTE">Pendientes de Revisión</option>
                <option value="LEIDO">Revisados / Leídos</option>
                <option value="TODOS">Todos los Mensajes</option>
              </select>

              <button
                onClick={() => cargarMensajes(1)}
                className="bg-[#016098] hover:bg-[#024a8d] text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Buscar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between text-xs text-slate-600">
              <span>
                Total: <strong>{mensajesData.total.toLocaleString('es-CL')}</strong> consultas registradas
              </span>
              <div className="flex gap-2">
                <button
                  disabled={mensajesData.page <= 1}
                  onClick={() => cargarMensajes(mensajesData.page - 1)}
                  className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={mensajesData.page >= mensajesData.totalPages}
                  onClick={() => cargarMensajes(mensajesData.page + 1)}
                  className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>

            {loadingMensajes ? (
              <div className="p-10 text-center text-slate-500">Cargando bandeja de mensajes...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {mensajesData.items.map((m) => (
                  <div key={m.id} className="p-5 hover:bg-slate-50 flex flex-col md:flex-row gap-4 justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            m.estado === 'PENDIENTE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {m.estado}
                        </span>
                        <span className="font-bold text-[#016098]">{m.nombreUsuario}</span>
                        <span className="font-mono text-xs text-slate-500">({m.rutFmt})</span>
                        <span className="text-xs text-slate-400">
                          · {new Date(m.fechaEnvio).toLocaleString('es-CL')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-line bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0]">
                        {m.mensaje}
                      </p>
                      <div className="text-xs text-slate-500 flex items-center gap-4">
                        <span>
                          Correo contacto: <strong>{m.email || 'No informado'}</strong>
                        </span>
                        {m.usuarioMod && (
                          <span>
                            Gestionado por: {m.usuarioMod}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 justify-end shrink-0">
                      {m.email && m.email.includes('@') && (
                        <a
                          href={`mailto:${m.email}?subject=Respuesta Consulta Portal Funcionario CMDS`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#e0f2fe] text-[#016098] hover:bg-blue-100"
                        >
                          <Mail className="w-3.5 h-3.5" /> Responder por Correo
                        </a>
                      )}
                      {m.estado === 'PENDIENTE' ? (
                        <button
                          onClick={() => handleCambiarEstadoMensaje(m.id, 'LEIDO')}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#39BABD] text-white hover:bg-[#2c989b]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Leído
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCambiarEstadoMensaje(m.id, 'PENDIENTE')}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-100"
                        >
                          Marcar Pendiente
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. AUDITORÍA */}
      {subTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={searchAudit}
              onChange={(e) => setSearchAudit(e.target.value)}
              placeholder="Filtrar por RUT o nombre..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[200px]"
            />
            <select
              value={filtroAccionAudit}
              onChange={(e) => setFiltroAccionAudit(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="TODAS">Todas las acciones</option>
              <option value="LOGIN">Inicios de Sesión (LOGIN)</option>
              <option value="DESCARGA_LIQUIDACION">Descargas de Liquidación</option>
              <option value="DESCARGA_CERT_ANTIGUEDAD">Descargas Certificado Antigüedad</option>
              <option value="CAMBIO_CLAVE">Cambios de Contraseña</option>
              <option value="RECUPERACION_CLAVE">Recuperaciones de Clave</option>
              <option value="CARGA_PLANTILLA_PERSONAL">Cargas CSV Personal</option>
              <option value="CARGA_PLANTILLA_RENTA">Cargas CSV Renta</option>
            </select>
            <button
              onClick={cargarAuditoria}
              className="bg-[#016098] hover:bg-[#024a8d] text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Consultar
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            {loadingAudit ? (
              <div className="p-10 text-center text-slate-500">Cargando bitácora de auditoría...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8fafc] text-gray-500 text-xs uppercase border-b border-[#e2e8f0]">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Acción</th>
                      <th className="px-4 py-3">Usuario</th>
                      <th className="px-4 py-3">Detalles</th>
                      <th className="px-4 py-3">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditoria.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(a.fecha).toLocaleString('es-CL')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#016098] text-xs">{a.accion}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-900">{a.rutUsuario}</span>{' '}
                          <span className="text-xs text-slate-500">{a.nombreUsuario}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 max-w-md truncate">
                          {a.detalles}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{a.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIO */}
      {modalNuevoUsuario && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-[#016098] text-white flex items-center justify-between">
              <h3 className="font-bold">Registrar o Actualizar Funcionario</h3>
              <button onClick={() => setModalNuevoUsuario(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGuardarNuevoUsuario} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#016098] mb-1">RUT *</label>
                  <input
                    type="text"
                    required
                    value={nuevoUserForm.rut}
                    onChange={(e) => setNuevoUserForm({ ...nuevoUserForm, rut: e.target.value })}
                    placeholder="Ej: 106334471"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#016098] mb-1">Rol</label>
                  <select
                    value={nuevoUserForm.rol}
                    onChange={(e) => setNuevoUserForm({ ...nuevoUserForm, rol: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="FUNCIONARIO">Funcionario</option>
                    <option value="ADMIN">Administrador RRHH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#016098] mb-1">Nombres</label>
                <input
                  type="text"
                  value={nuevoUserForm.nombres}
                  onChange={(e) => setNuevoUserForm({ ...nuevoUserForm, nombres: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#016098] mb-1">Apellido Paterno</label>
                  <input
                    type="text"
                    value={nuevoUserForm.apellidoPaterno}
                    onChange={(e) =>
                      setNuevoUserForm({ ...nuevoUserForm, apellidoPaterno: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#016098] mb-1">Apellido Materno</label>
                  <input
                    type="text"
                    value={nuevoUserForm.apellidoMaterno}
                    onChange={(e) =>
                      setNuevoUserForm({ ...nuevoUserForm, apellidoMaterno: e.target.value })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#016098] mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={nuevoUserForm.email}
                    onChange={(e) => setNuevoUserForm({ ...nuevoUserForm, email: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#016098] mb-1">
                    Clave Inicial (Opcional)
                  </label>
                  <input
                    type="text"
                    value={nuevoUserForm.password}
                    onChange={(e) => setNuevoUserForm({ ...nuevoUserForm, password: e.target.value })}
                    placeholder="Por defecto: 4 últimos dígitos RUT"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalNuevoUsuario(false)}
                  className="px-4 py-2 rounded-lg border text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#016098] hover:bg-[#024a8d] text-white text-sm font-semibold"
                >
                  Guardar Funcionario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INSPECTOR DE DOCUMENTOS DE UN FUNCIONARIO */}
      {inspectorUsuario && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-[#016098] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold">
                  Documentos de {inspectorUsuario.nombreCompleto} ({inspectorUsuario.rutFmt})
                </h3>
                <p className="text-xs text-blue-200">
                  {inspectorUsuario.unidad || 'CMDS'} · {inspectorUsuario.cargo || 'Funcionario'}
                </p>
              </div>
              <button onClick={() => setInspectorUsuario(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between bg-[#e0f2fe]/60 border border-blue-200 rounded-xl p-4">
                <div>
                  <h4 className="font-bold text-[#016098] text-sm">Certificado de Antigüedad Oficial</h4>
                  <p className="text-xs text-slate-600">
                    Emitir certificado firmado con los contratos vigentes del funcionario.
                  </p>
                </div>
                <a
                  href={getPdfDownloadUrl(`/certificados/antiguedad/pdf?rut=${inspectorUsuario.rut}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#016098] hover:bg-[#024a8d] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" /> Descargar Certificado PDF
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-[#016098] text-sm">
                  Liquidaciones de Sueldo (5 Años Móviles: {liqInspector.length} totales)
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {[2026, 2025, 2024, 2023, 2022].map((a) => {
                    const countA = liqInspector.filter((l) => Number(l.anio) === a).length;
                    return (
                      <button
                        key={a}
                        onClick={() => setAnioInspector(a)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                          anioInspector === a
                            ? 'bg-[#016098] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-[#e0f2fe] hover:text-[#016098]'
                        }`}
                      >
                        {a} ({countA})
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setAnioInspector(0)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                      anioInspector === 0
                        ? 'bg-[#016098] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-[#e0f2fe] hover:text-[#016098]'
                    }`}
                  >
                    Todos ({liqInspector.length})
                  </button>
                </div>
              </div>

              {loadingInspector ? (
                <div className="p-8 text-center text-slate-500 text-sm">Cargando liquidaciones...</div>
              ) : liqInspector.filter((l) => anioInspector === 0 || Number(l.anio) === anioInspector).length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-xl">
                  Este funcionario no registra liquidaciones en el período seleccionado.
                </div>
              ) : (
                <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">Período</th>
                      <th className="px-3 py-2.5">Unidad</th>
                      <th className="px-3 py-2.5 text-right">Total Haberes</th>
                      <th className="px-3 py-2.5 text-right">Líquido a Pago</th>
                      <th className="px-3 py-2.5 text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {liqInspector
                      .filter((l) => anioInspector === 0 || Number(l.anio) === anioInspector)
                      .map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-semibold text-[#016098]">{l.periodoFmt}</td>
                          <td className="px-3 py-2.5 text-xs">{l.nomUnidad}</td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            ${Number(l.totHaberes).toLocaleString('es-CL')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                            ${Number(l.liquidoPago).toLocaleString('es-CL')}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <a
                              href={getPdfDownloadUrl(`/liquidaciones/${l.id}/pdf`)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#016098] text-white text-xs font-semibold hover:bg-[#024a8d]"
                            >
                              <Download className="w-3.5 h-3.5" /> PDF
                            </a>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
