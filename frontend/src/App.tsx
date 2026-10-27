import React, { useEffect, useState } from 'react';
import {
  FileText,
  Award,
  User,
  MessageSquare,
  KeyRound,
  LogOut,
  Shield,
  Download,
  Eye,
  Building2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  X,
  Briefcase,
  CreditCard,
  HeartPulse,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  Users,
  ShieldAlert,
  Menu,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { api, getPdfDownloadUrl } from './api';
import { AdminPanel, AdminSubTab } from './components/AdminPanel';

export function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);

  // Login Form
  const [rutLogin, setRutLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Recuperación de Clave Modal
  const [modalRecuperar, setModalRecuperar] = useState(false);
  const [rutRecuperar, setRutRecuperar] = useState('');
  const [infoRecuperacion, setInfoRecuperacion] = useState<any | null>(null);
  const [respuestasRecup, setRespuestasRecup] = useState<Record<number, string>>({
    1: '',
    2: '',
    3: '',
  });
  const [nuevaPassRecup, setNuevaPassRecup] = useState('');
  const [msgRecuperar, setMsgRecuperar] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(
    null
  );
  const [loadingRecuperar, setLoadingRecuperar] = useState(false);

  // Vista activa: 'funcionario' | 'admin'
  const [vistaModo, setVistaModo] = useState<'funcionario' | 'admin'>('funcionario');
  const [tabFuncionario, setTabFuncionario] = useState<
    'liquidaciones' | 'certificados' | 'datos' | 'mensajes' | 'seguridad'
  >('liquidaciones');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('dashboard');

  // Datos Portal Funcionario
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [loadingLiq, setLoadingLiq] = useState(false);
  const [anioFiltroLiq, setAnioFiltroLiq] = useState<number>(2026);
  const [modoVistaLiq, setModoVistaLiq] = useState<'tarjetones' | 'tabla'>('tarjetones');
  const [detalleModal, setDetalleModal] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [infoAntiguedad, setInfoAntiguedad] = useState<any | null>(null);
  const [misDatos, setMisDatos] = useState<any | null>(null);
  const [misMensajes, setMisMensajes] = useState<any[]>([]);
  const [emailContacto, setEmailContacto] = useState('');
  const [textoMensaje, setTextoMensaje] = useState('');
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);

  // Seguridad / Cambio de Clave y Preguntas
  const [catalogoPreguntas, setCatalogoPreguntas] = useState<any[]>([]);
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [preguntasForm, setPreguntasForm] = useState([
    { orden: 1, codigo: '101', respuesta: '' },
    { orden: 2, codigo: '102', respuesta: '' },
    { orden: 3, codigo: '103', respuesta: '' },
  ]);
  const [alertaPortal, setAlertaPortal] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(
    null
  );

  const mostrarAlerta = (tipo: 'ok' | 'err', texto: string) => {
    setAlertaPortal({ tipo, texto });
    setTimeout(() => setAlertaPortal(null), 6000);
  };

  useEffect(() => {
    const token = localStorage.getItem('totem_cmds_token');
    if (!token) {
      setLoadingSession(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data);
        setEmailContacto(res.data.email || '');
        if (res.data.esNuevo) {
          setTabFuncionario('seguridad');
        }
      })
      .catch(() => {
        localStorage.removeItem('totem_cmds_token');
      })
      .finally(() => setLoadingSession(false));
  }, []);

  useEffect(() => {
    api
      .get('/auth/preguntas-catalogo')
      .then((res) => setCatalogoPreguntas(res.data))
      .catch(() => {});
  }, []);

  const cargarDatosFuncionario = async () => {
    if (!user) return;
    setLoadingLiq(true);
    try {
      const [resLiq, resAnt, resDatos, resMsg] = await Promise.all([
        api.get('/liquidaciones').catch(() => ({ data: [] })),
        api.get('/certificados/antiguedad/info').catch(() => ({ data: null })),
        api.get('/mis-datos').catch(() => ({ data: null })),
        api.get('/mensajes/mis-mensajes').catch(() => ({ data: [] })),
      ]);
      const listaLiq = resLiq.data || [];
      setLiquidaciones(listaLiq);
      if (listaLiq.length > 0) {
        const aniosDisponibles = Array.from(new Set(listaLiq.map((l: any) => Number(l.anio)))).sort(
          (a: any, b: any) => b - a
        ) as number[];
        if (!aniosDisponibles.includes(anioFiltroLiq)) {
          setAnioFiltroLiq(aniosDisponibles[0]);
        }
      }
      setInfoAntiguedad(resAnt.data);
      setMisDatos(resDatos.data);
      setMisMensajes(resMsg.data || []);
    } finally {
      setLoadingLiq(false);
    }
  };

  useEffect(() => {
    if (user) {
      cargarDatosFuncionario();
    }
  }, [user?.id, tabFuncionario, vistaModo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin('');
    setSubmittingLogin(true);
    try {
      const { data } = await api.post('/auth/login', {
        rut: rutLogin,
        password: passwordLogin,
      });
      localStorage.setItem('totem_cmds_token', data.token);
      setUser(data.user);
      setEmailContacto(data.user.email || '');
      if (data.user.esNuevo) {
        setTabFuncionario('seguridad');
      } else {
        setTabFuncionario('liquidaciones');
      }
    } catch (err: any) {
      setErrorLogin(err.response?.data?.error || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('totem_cmds_token');
    setUser(null);
    setPasswordLogin('');
    setVistaModo('funcionario');
  };

  const handleVerDetalleLiquidacion = async (id: number) => {
    setLoadingDetalle(true);
    try {
      const { data } = await api.get(`/liquidaciones/${id}/detalle`);
      setDetalleModal(data);
    } catch (err: any) {
      mostrarAlerta('err', err.response?.data?.error || 'Error al cargar el detalle de la liquidación.');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleEnviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoMensaje(true);
    try {
      const { data } = await api.post('/mensajes', {
        email: emailContacto,
        mensaje: textoMensaje,
      });
      mostrarAlerta('ok', data.mensaje);
      setTextoMensaje('');
      const resMsg = await api.get('/mensajes/mis-mensajes');
      setMisMensajes(resMsg.data || []);
    } catch (err: any) {
      mostrarAlerta('err', err.response?.data?.error || 'Error enviando mensaje.');
    } finally {
      setEnviandoMensaje(false);
    }
  };

  const handleGuardarClaveYPreguntas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevaPassword !== confirmarPassword) {
      mostrarAlerta('err', 'La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    const tieneRespuestas = preguntasForm.every((p) => p.respuesta.trim().length > 0);
    if (tieneRespuestas) {
      const codigosUnicos = new Set(preguntasForm.map((p) => p.codigo));
      if (codigosUnicos.size < 3) {
        mostrarAlerta('err', 'Por favor seleccione 3 preguntas de seguridad distintas.');
        return;
      }
    }

    try {
      const { data } = await api.post('/auth/cambiar-clave', {
        passwordActual: passwordActual || undefined,
        nuevaPassword,
        email: emailContacto || undefined,
        respuestas: tieneRespuestas ? preguntasForm : undefined,
      });
      mostrarAlerta('ok', data.mensaje);
      setPasswordActual('');
      setNuevaPassword('');
      setConfirmarPassword('');
      setUser({
        ...user,
        esNuevo: false,
        tienePreguntasSeguridad: tieneRespuestas || user.tienePreguntasSeguridad,
      });
    } catch (err: any) {
      mostrarAlerta('err', err.response?.data?.error || 'Error actualizando contraseña.');
    }
  };

  const handleValidarRutRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgRecuperar(null);
    setLoadingRecuperar(true);
    try {
      const { data } = await api.post('/auth/validar-rut', { rut: rutRecuperar });
      setInfoRecuperacion(data);
    } catch (err: any) {
      setMsgRecuperar({
        tipo: 'err',
        texto: err.response?.data?.error || 'No se encontró el RUT ingresado.',
      });
    } finally {
      setLoadingRecuperar(false);
    }
  };

  const handleResponderPreguntasRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgRecuperar(null);
    setLoadingRecuperar(true);
    try {
      const payloadRespuestas = (infoRecuperacion.preguntas || []).map((p: any) => ({
        orden: p.orden,
        respuesta: respuestasRecup[p.orden] || '',
      }));

      const { data } = await api.post('/auth/responder-preguntas', {
        rut: infoRecuperacion.rut,
        respuestas: payloadRespuestas,
        nuevaPassword: nuevaPassRecup,
      });

      setMsgRecuperar({ tipo: 'ok', texto: data.mensaje });
      setTimeout(() => {
        setModalRecuperar(false);
        setInfoRecuperacion(null);
        setRutLogin(infoRecuperacion.rutFmt);
      }, 2200);
    } catch (err: any) {
      setMsgRecuperar({
        tipo: 'err',
        texto: err.response?.data?.error || 'Respuestas incorrectas.',
      });
    } finally {
      setLoadingRecuperar(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7f6] text-[#016098]">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-[#016098] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#016098]">Cargando Portal del Funcionario CMDS...</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // PANTALLA DE LOGIN (ESTILO CORPORATIVO CMDS SPLIT-SCREEN)
  // ==========================================================================
  if (!user) {
    return (
      <div className="flex h-screen w-full bg-gray-50">
        {/* Panel Izquierdo Corporativo (Logo y Branding CMDS) */}
        <div className="hidden md:flex flex-col justify-center items-center w-1/2 bg-[#016098] text-white p-12 shadow-[10px_0_15px_-3px_rgba(0,0,0,0.1)] z-10">
          <div className="bg-white p-6 rounded-2xl shadow-xl mb-8">
            <img src="/logo.png" alt="CMDS Logo" className="w-48 h-48 object-contain" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-wider text-yellow-400 mb-4 text-center">
            CMDS
          </h1>
          <h2 className="text-xl font-semibold text-blue-200 tracking-wide text-center">
            Portal de Autoatención y Gestión de
          </h2>
          <h2 className="text-2xl font-bold text-white uppercase mt-2 tracking-widest text-center">
            Remuneraciones y Certificados
          </h2>
          <div className="mt-12 w-16 h-1 bg-yellow-400 rounded"></div>
        </div>

        {/* Panel Derecho (Formulario de Login) */}
        <div className="flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-6">
          <div className="w-full max-w-md">
            {/* Logo visible solo en mobile */}
            <div className="md:hidden flex justify-center mb-8">
              <img src="/logo.png" alt="CMDS Logo" className="w-32 h-32 object-contain" />
            </div>

            <h3 className="text-3xl font-bold text-[#016098] mb-2">Bienvenido</h3>
            <p className="text-gray-500 mb-8">Ingresa tus credenciales para continuar</p>

            {errorLogin && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 shadow-sm flex items-center gap-3 font-semibold text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <span>{errorLogin}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  className="block text-[#016098] text-sm font-bold mb-2 uppercase tracking-wide"
                  htmlFor="rutLogin"
                >
                  RUT Funcionario(a)
                </label>
                <input
                  id="rutLogin"
                  type="text"
                  required
                  value={rutLogin}
                  onChange={(e) => setRutLogin(e.target.value)}
                  placeholder="Ej: 106334471 o 10633447-1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016098] focus:bg-white transition shadow-sm text-gray-800 font-medium"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Sin puntos ni guión (ej: 106334471), solo cuerpo (10633447) o con guión.
                </p>
              </div>

              <div>
                <label
                  className="block text-[#016098] text-sm font-bold mb-2 uppercase tracking-wide"
                  htmlFor="passwordLogin"
                >
                  Contraseña
                </label>
                <input
                  id="passwordLogin"
                  type="password"
                  required
                  value={passwordLogin}
                  onChange={(e) => setPasswordLogin(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016098] focus:bg-white transition shadow-sm text-gray-800 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submittingLogin}
                className="w-full bg-[#016098] hover:bg-[#024a8d] disabled:opacity-70 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-lg mt-4 flex justify-center items-center gap-2"
              >
                {submittingLogin ? 'Verificando credenciales...' : 'Ingresar al Sistema'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setModalRecuperar(true);
                  setInfoRecuperacion(null);
                  setMsgRecuperar(null);
                  setRutRecuperar(rutLogin);
                }}
                className="text-xs font-bold text-[#016098] hover:underline inline-flex items-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4" />
                ¿Olvidaste tu contraseña? Recupérala con tus preguntas de seguridad
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400 font-semibold">
                &copy; 2026 CMDS - Corporación Municipal de Desarrollo Social de Antofagasta
              </p>
            </div>
          </div>
        </div>

        {/* MODAL RECUPERAR CONTRASEÑA */}
        {modalRecuperar && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="px-6 py-4 bg-[#016098] text-white flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Recuperación de Contraseña
                </h3>
                <button onClick={() => setModalRecuperar(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {msgRecuperar && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      msgRecuperar.tipo === 'ok'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {msgRecuperar.texto}
                  </div>
                )}

                {!infoRecuperacion ? (
                  <form onSubmit={handleValidarRutRecuperar} className="space-y-4">
                    <p className="text-xs text-slate-600">
                      Ingrese su RUT para consultar sus preguntas de seguridad registradas en el sistema.
                    </p>
                    <div>
                      <label className="block text-xs font-bold text-[#016098] uppercase mb-1">RUT</label>
                      <input
                        type="text"
                        required
                        value={rutRecuperar}
                        onChange={(e) => setRutRecuperar(e.target.value)}
                        placeholder="Ej: 106334471 o 10633447-1"
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#016098]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingRecuperar}
                      className="w-full bg-[#016098] hover:bg-[#024a8d] text-white font-semibold py-2.5 rounded-lg text-sm"
                    >
                      {loadingRecuperar ? 'Validando RUT...' : 'Continuar'}
                    </button>
                  </form>
                ) : !infoRecuperacion.tienePreguntas ? (
                  <div className="space-y-4 text-center py-2">
                    <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">
                      {infoRecuperacion.nombreCompleto} ({infoRecuperacion.rutFmt})
                    </p>
                    <p className="text-xs text-slate-600">
                      Su cuenta aún no registra preguntas de seguridad configuradas. Si es su primer ingreso, su contraseña inicial corresponde a los <strong>últimos 4 dígitos de su RUT sin dígito verificador</strong>. De lo contrario, solicite el restablecimiento a Recursos Humanos.
                    </p>
                    <button
                      onClick={() => setInfoRecuperacion(null)}
                      className="w-full border border-slate-300 py-2 rounded-lg text-xs font-semibold text-slate-700"
                    >
                      Volver
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResponderPreguntasRecuperar} className="space-y-3.5">
                    <div className="bg-[#e0f2fe] border border-blue-200 rounded-xl p-3 text-xs text-[#016098]">
                      Funcionario(a): <strong>{infoRecuperacion.nombreCompleto}</strong> (
                      {infoRecuperacion.rutFmt})
                    </div>

                    {(infoRecuperacion.preguntas || []).map((p: any) => (
                      <div key={p.orden}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {p.orden}. {p.pregunta}
                        </label>
                        <input
                          type="text"
                          required
                          value={respuestasRecup[p.orden] || ''}
                          onChange={(e) =>
                            setRespuestasRecup({
                              ...respuestasRecup,
                              [p.orden]: e.target.value,
                            })
                          }
                          placeholder="Su respuesta..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}

                    <div className="pt-2 border-t">
                      <label className="block text-xs font-bold text-[#016098] mb-1">
                        Defina su Nueva Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={nuevaPassRecup}
                        onChange={(e) => setNuevaPassRecup(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setInfoRecuperacion(null)}
                        className="flex-1 py-2.5 rounded-lg border text-xs font-semibold text-slate-600"
                      >
                        Atrás
                      </button>
                      <button
                        type="submit"
                        disabled={loadingRecuperar}
                        className="flex-1 py-2.5 rounded-lg bg-[#016098] hover:bg-[#024a8d] text-white text-xs font-semibold"
                      >
                        {loadingRecuperar ? 'Verificando...' : 'Restablecer Contraseña'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const ultimaLiq = liquidaciones[0] || null;

  const tituloSeccionActual = () => {
    if (vistaModo === 'admin') {
      switch (adminSubTab) {
        case 'dashboard':
          return 'Panel de Administración RRHH — Indicadores Generales';
        case 'plantillas':
          return 'Gestión de Plantillas Mensuales de Remuneraciones (CSV)';
        case 'usuarios':
          return 'Mantenedor de Funcionarios y Administradores';
        case 'mensajes':
          return 'Bandeja de Consultas y Solicitudes a RRHH';
        case 'auditoria':
          return 'Bitácora de Auditoría y Seguridad';
      }
    }
    switch (tabFuncionario) {
      case 'liquidaciones':
        return 'Mis Liquidaciones de Remuneraciones';
      case 'certificados':
        return 'Certificado de Antigüedad Laboral';
      case 'datos':
        return 'Ficha de Datos Personales, Contractuales y Previsionales';
      case 'mensajes':
        return 'Consultas y Solicitudes a Recursos Humanos';
      case 'seguridad':
        return 'Configuración de Seguridad y Contraseña';
    }
  };

  // ==========================================================================
  // PORTAL AUTENTICADO (SIDEBAR CORPORATIVO BLANCO + CONTENIDO DERECHO)
  // ==========================================================================
  return (
    <div className="flex h-screen bg-[#f4f7f6] font-sans text-[#1e293b] overflow-hidden">
      {/* Botón menú móvil */}
      <button
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-md shadow-md text-[#016098]"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Corporativo CMDS (Estilo Licencias Médicas / Traspaso SLEP) */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-[265px] bg-white border-r border-[#e2e8f0] flex flex-col shrink-0
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo / Header del Sidebar */}
        <div className="p-6 flex flex-col items-center border-b border-[#e2e8f0]">
          <img
            src="/logo.png"
            alt="CMDS Logo"
            className="w-full max-w-[135px] h-auto object-contain mb-2"
          />
          <span className="text-[0.95rem] text-[#64748b] text-center font-semibold leading-tight mt-1">
            Portal del Funcionario
            <br />
            <span className="text-xs text-[#016098] font-bold">Totem Web CMDS</span>
          </span>

          <div className="flex flex-col items-center mt-4 text-center w-full">
            <div className="flex items-center justify-center gap-2 text-xs text-[#016098] bg-[#e0f2fe] px-3 py-1.5 rounded-full font-semibold tracking-wide max-w-full">
              <span className="w-2 h-2 bg-[#39BABD] rounded-full shrink-0"></span>
              <span className="truncate" title={user.nombreCompleto}>
                {user.nombreCompleto}
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-1 font-mono">{user.rutFmt}</span>

            {user.rol === 'ADMIN' && (
              <span className="mt-1.5 text-[10px] font-bold uppercase bg-[#016098] text-white px-2.5 py-0.5 rounded">
                Administrador RRHH
              </span>
            )}
          </div>
        </div>

        {/* Navegación Lateral */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mi Portal Funcionario
          </div>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => {
                  setVistaModo('funcionario');
                  setTabFuncionario('liquidaciones');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  vistaModo === 'funcionario' && tabFuncionario === 'liquidaciones'
                    ? 'bg-[#016098] text-white shadow-sm'
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                }`}
              >
                <FileText size={17} />
                <span>Mis Liquidaciones</span>
              </button>
            </li>

            <li>
              <button
                onClick={() => {
                  setVistaModo('funcionario');
                  setTabFuncionario('certificados');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  vistaModo === 'funcionario' && tabFuncionario === 'certificados'
                    ? 'bg-[#016098] text-white shadow-sm'
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                }`}
              >
                <Award size={17} />
                <span>Certificado de Antigüedad</span>
              </button>
            </li>

            <li>
              <button
                onClick={() => {
                  setVistaModo('funcionario');
                  setTabFuncionario('datos');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  vistaModo === 'funcionario' && tabFuncionario === 'datos'
                    ? 'bg-[#016098] text-white shadow-sm'
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                }`}
              >
                <User size={17} />
                <span>Mis Datos Personales</span>
              </button>
            </li>

            <li>
              <button
                onClick={() => {
                  setVistaModo('funcionario');
                  setTabFuncionario('mensajes');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  vistaModo === 'funcionario' && tabFuncionario === 'mensajes'
                    ? 'bg-[#016098] text-white shadow-sm'
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                }`}
              >
                <MessageSquare size={17} />
                <span>Consultas a RRHH</span>
              </button>
            </li>

            <li>
              <button
                onClick={() => {
                  setVistaModo('funcionario');
                  setTabFuncionario('seguridad');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  vistaModo === 'funcionario' && tabFuncionario === 'seguridad'
                    ? 'bg-[#016098] text-white shadow-sm'
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                }`}
              >
                <KeyRound size={17} />
                <span>Seguridad y Clave</span>
              </button>
            </li>
          </ul>

          {/* Menú de Administración RRHH */}
          {user.rol === 'ADMIN' && (
            <div className="pt-4 mt-4 border-t border-[#e2e8f0]">
              <button
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className="flex justify-between items-center w-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#016098]"
              >
                <span className="flex items-center gap-1.5">
                  <Shield size={14} /> Administración RRHH
                </span>
                {adminMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {adminMenuOpen && (
                <ul className="mt-1 space-y-1">
                  <li>
                    <button
                      onClick={() => {
                        setVistaModo('admin');
                        setAdminSubTab('dashboard');
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        vistaModo === 'admin' && adminSubTab === 'dashboard'
                          ? 'bg-[#016098] text-white shadow-sm'
                          : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                      }`}
                    >
                      <BarChart3 size={17} />
                      <span>Dashboard RRHH</span>
                    </button>
                  </li>

                  <li>
                    <button
                      onClick={() => {
                        setVistaModo('admin');
                        setAdminSubTab('plantillas');
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        vistaModo === 'admin' && adminSubTab === 'plantillas'
                          ? 'bg-[#016098] text-white shadow-sm'
                          : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                      }`}
                    >
                      <FileSpreadsheet size={17} />
                      <span>Plantillas CSV</span>
                    </button>
                  </li>

                  <li>
                    <button
                      onClick={() => {
                        setVistaModo('admin');
                        setAdminSubTab('usuarios');
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        vistaModo === 'admin' && adminSubTab === 'usuarios'
                          ? 'bg-[#016098] text-white shadow-sm'
                          : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                      }`}
                    >
                      <Users size={17} />
                      <span>Mantenedor Usuarios</span>
                    </button>
                  </li>

                  <li>
                    <button
                      onClick={() => {
                        setVistaModo('admin');
                        setAdminSubTab('mensajes');
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        vistaModo === 'admin' && adminSubTab === 'mensajes'
                          ? 'bg-[#016098] text-white shadow-sm'
                          : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                      }`}
                    >
                      <MessageSquare size={17} />
                      <span>Bandeja Consultas</span>
                    </button>
                  </li>

                  <li>
                    <button
                      onClick={() => {
                        setVistaModo('admin');
                        setAdminSubTab('auditoria');
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        vistaModo === 'admin' && adminSubTab === 'auditoria'
                          ? 'bg-[#016098] text-white shadow-sm'
                          : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#016098]'
                      }`}
                    >
                      <ShieldAlert size={17} />
                      <span>Auditoría SGSI</span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </nav>

        {/* Pie del Sidebar (Botón Cerrar Sesión Estilo Siniestros / Licencias) */}
        <div className="p-4 border-t border-[#e2e8f0]">
          <button
            onClick={handleLogout}
            className="w-full bg-white border border-[#EB567F] text-[#EB567F] hover:bg-[#EB567F] hover:text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenedor Principal Derecho */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Cabecera Superior Blanca */}
        <header className="bg-white border-b border-[#e2e8f0] px-6 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-[#016098]">{tituloSeccionActual()}</h1>
            <p className="text-xs text-gray-500">
              Corporación Municipal de Desarrollo Social de Antofagasta &bull; Unidad:{' '}
              <strong className="text-gray-700">
                {ultimaLiq?.nomUnidad || user.unidad || 'CMDS Antofagasta'}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={getPdfDownloadUrl('/certificados/antiguedad/pdf')}
              target="_blank"
              rel="noreferrer"
              className="bg-[#016098] hover:bg-[#024a8d] text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Award className="w-4 h-4" />
              Certificado Antigüedad
            </a>
          </div>
        </header>

        {/* Área de Contenido Scrollable */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {alertaPortal && (
            <div
              className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
                alertaPortal.tipo === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2.5 text-sm font-medium">
                {alertaPortal.tipo === 'ok' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span>{alertaPortal.texto}</span>
              </div>
              <button onClick={() => setAlertaPortal(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {vistaModo === 'admin' && user.rol === 'ADMIN' ? (
            <AdminPanel activeSubTab={adminSubTab} onSelectSubTab={setAdminSubTab} />
          ) : (
            <div className="space-y-6">
              {/* Aviso si es usuario nuevo o sin preguntas de seguridad */}
              {(user.esNuevo || !user.tienePreguntasSeguridad) && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 text-amber-900 text-xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <strong>Recomendación de Seguridad:</strong> Configure su contraseña personal y sus 3 preguntas de seguridad para poder recuperar su clave en caso de olvido.
                    </div>
                  </div>
                  <button
                    onClick={() => setTabFuncionario('seguridad')}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                  >
                    Configurar Ahora
                  </button>
                </div>
              )}

              {/* TAB 1: MIS LIQUIDACIONES DE SUELDO (5 AÑOS MÓVILES + TARJETONES MENSUALES) */}
              {tabFuncionario === 'liquidaciones' && (
                <div className="space-y-6">
                  {ultimaLiq && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-[#016098]">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          Último Período Emitido
                        </span>
                        <p className="text-2xl font-black text-gray-800 mt-1">
                          {ultimaLiq.periodoFmt}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {ultimaLiq.diasTrab} días trabajados · {ultimaLiq.horas} hrs
                        </p>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-[#39BABD]">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          Total Haberes ({ultimaLiq.periodoFmt})
                        </span>
                        <p className="text-2xl font-black text-[#016098] mt-1 font-mono">
                          $ {Number(ultimaLiq.totHaberes).toLocaleString('es-CL')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Imponible: $ {Number(ultimaLiq.montoImponi).toLocaleString('es-CL')}
                        </p>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-[#EB567F]">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          Total Descuentos ({ultimaLiq.periodoFmt})
                        </span>
                        <p className="text-2xl font-black text-[#EB567F] mt-1 font-mono">
                          $ {Number(ultimaLiq.totDesctos).toLocaleString('es-CL')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          AFP: {ultimaLiq.nomAfp} · Salud: {ultimaLiq.nomSalud}
                        </p>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm p-5 border border-[#e2e8f0] border-l-4 border-l-green-500">
                        <span className="text-xs font-bold uppercase text-green-700">
                          Alcance Líquido a Pago
                        </span>
                        <p className="text-2xl font-black text-green-600 mt-1 font-mono">
                          $ {Number(ultimaLiq.liquidoPago).toLocaleString('es-CL')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{ultimaLiq.formaPago}</p>
                      </div>
                    </div>
                  )}

                  {/* Barra de Filtro de 5 Años Móviles y Selector Tarjetones / Tabla */}
                  <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-2 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#016098]" />
                        Año de Consulta (5 Años Móviles):
                      </span>
                      {[2026, 2025, 2024, 2023, 2022].map((anio) => {
                        const cantidadPorAnio = liquidaciones.filter(
                          (l) => Number(l.anio) === anio
                        ).length;
                        const activo = anioFiltroLiq === anio;
                        return (
                          <button
                            key={anio}
                            onClick={() => setAnioFiltroLiq(anio)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                              activo
                                ? 'bg-[#016098] text-white shadow-sm'
                                : 'bg-[#f8fafc] text-slate-600 hover:bg-[#e0f2fe] hover:text-[#016098] border border-[#e2e8f0]'
                            }`}
                          >
                            <span>{anio}</span>
                            <span
                              className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                                activo
                                  ? 'bg-[#39BABD] text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {cantidadPorAnio}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setAnioFiltroLiq(0)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                          anioFiltroLiq === 0
                            ? 'bg-[#016098] text-white shadow-sm'
                            : 'bg-[#f8fafc] text-slate-600 hover:bg-[#e0f2fe] hover:text-[#016098] border border-[#e2e8f0]'
                        }`}
                      >
                        <span>Todos (5 Años)</span>
                        <span
                          className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                            anioFiltroLiq === 0
                              ? 'bg-[#39BABD] text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {liquidaciones.length}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <button
                        onClick={cargarDatosFuncionario}
                        className="p-2 rounded-lg border border-[#e2e8f0] text-slate-500 hover:text-[#016098] hover:bg-slate-50 transition"
                        title="Actualizar liquidaciones"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingLiq ? 'animate-spin' : ''}`} />
                      </button>

                      <div className="bg-[#f8fafc] p-1 rounded-lg border border-[#e2e8f0] flex items-center text-xs font-semibold">
                        <button
                          onClick={() => setModoVistaLiq('tarjetones')}
                          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                            modoVistaLiq === 'tarjetones'
                              ? 'bg-[#016098] text-white shadow-sm'
                              : 'text-slate-600 hover:text-[#016098]'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          Tarjetones
                        </button>
                        <button
                          onClick={() => setModoVistaLiq('tabla')}
                          className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                            modoVistaLiq === 'tabla'
                              ? 'bg-[#016098] text-white shadow-sm'
                              : 'text-slate-600 hover:text-[#016098]'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" />
                          Tabla
                        </button>
                      </div>
                    </div>
                  </div>

                  {loadingLiq ? (
                    <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center text-slate-500">
                      Consultando liquidaciones de sueldo...
                    </div>
                  ) : liquidaciones.filter((l) => anioFiltroLiq === 0 || Number(l.anio) === anioFiltroLiq).length === 0 ? (
                    <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center space-y-2">
                      <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">
                        No se encontraron liquidaciones registradas para el período seleccionado.
                      </p>
                      <p className="text-xs text-slate-400">
                        Seleccione otro año en la barra superior para consultar períodos anteriores.
                      </p>
                    </div>
                  ) : modoVistaLiq === 'tarjetones' ? (
                    /* VISTA DE TARJETONES MENSUALES */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {liquidaciones
                        .filter((l) => anioFiltroLiq === 0 || Number(l.anio) === anioFiltroLiq)
                        .map((l) => (
                          <div
                            key={l.id}
                            className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                          >
                            {/* Cabecera del Tarjetón */}
                            <div>
                              <div className="bg-[#016098] text-white px-5 py-3.5 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="bg-white/15 p-1.5 rounded-lg">
                                    <Calendar className="w-4 h-4 text-yellow-400" />
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-sm uppercase tracking-wide">
                                      {l.periodoFmt}
                                    </h4>
                                    <span className="text-[10px] text-blue-200 font-mono">
                                      Período #{l.periodo}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#39BABD] text-white">
                                  {l.detalleCont || 'CONTRATO'}
                                </span>
                              </div>

                              {/* Cuerpo del Tarjetón */}
                              <div className="p-5 space-y-4">
                                <div className="space-y-1">
                                  <div className="text-xs font-bold text-[#016098] truncate" title={l.nomUnidad}>
                                    {l.codUnidad} - {l.nomUnidad}
                                  </div>
                                  <div className="text-xs text-slate-600 font-medium truncate">
                                    {l.descripcionCargo || 'Funcionario(a)'}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                                    <span>{l.diasTrab} días trab.</span>
                                    <span>&bull;</span>
                                    <span>{l.horas} hrs sem.</span>
                                    <span>&bull;</span>
                                    <span>{l.nomSucursal}</span>
                                  </div>
                                </div>

                                {/* Resumen Financiero del Mes */}
                                <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0] space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Total Haberes:</span>
                                    <span className="font-mono font-bold text-[#016098]">
                                      $ {Number(l.totHaberes).toLocaleString('es-CL')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Total Descuentos:</span>
                                    <span className="font-mono font-bold text-[#EB567F]">
                                      - $ {Number(l.totDesctos).toLocaleString('es-CL')}
                                    </span>
                                  </div>
                                  <div className="border-t border-[#e2e8f0] pt-2 flex justify-between items-center">
                                    <span className="font-bold text-slate-800 uppercase text-[11px]">
                                      Líquido a Pago:
                                    </span>
                                    <span className="font-mono font-black text-base text-green-600">
                                      $ {Number(l.liquidoPago).toLocaleString('es-CL')}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span>AFP: {l.nomAfp || '-'}</span>
                                  <span>Salud: {l.nomSalud || '-'}</span>
                                  <span className="font-semibold text-slate-500">{l.formaPago}</span>
                                </div>
                              </div>
                            </div>

                            {/* Pie del Tarjetón (Botones de Acción) */}
                            <div className="px-5 py-3.5 bg-slate-50 border-t border-[#e2e8f0] flex items-center gap-2.5">
                              <button
                                onClick={() => handleVerDetalleLiquidacion(l.id)}
                                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-[#e0f2fe] text-[#016098] hover:bg-blue-100 transition flex items-center justify-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver Desglose
                              </button>
                              <a
                                href={getPdfDownloadUrl(`/liquidaciones/${l.id}/pdf`)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-[#016098] text-white hover:bg-[#024a8d] transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Descargar PDF
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    /* VISTA DE TABLA COMPACTA */
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-[#f8fafc] text-gray-500 text-xs uppercase border-b border-[#e2e8f0]">
                            <tr>
                              <th className="px-5 py-3.5">Período</th>
                              <th className="px-5 py-3.5">Establecimiento / Unidad</th>
                              <th className="px-5 py-3.5">Cargo / Calidad</th>
                              <th className="px-5 py-3.5 text-center">Días / Hrs</th>
                              <th className="px-5 py-3.5 text-right">Total Haberes</th>
                              <th className="px-5 py-3.5 text-right">Total Desctos</th>
                              <th className="px-5 py-3.5 text-right">Líquido a Pago</th>
                              <th className="px-5 py-3.5 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {liquidaciones
                              .filter((l) => anioFiltroLiq === 0 || Number(l.anio) === anioFiltroLiq)
                              .map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50 transition">
                                  <td className="px-5 py-4 font-bold text-[#016098] whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-[#39BABD]" />
                                      {l.periodoFmt}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="font-semibold text-slate-800 text-xs">
                                      {l.codUnidad} - {l.nomUnidad}
                                    </div>
                                    <div className="text-[11px] text-slate-400">{l.nomSucursal}</div>
                                  </td>
                                  <td className="px-5 py-4 text-xs">
                                    <div className="font-medium text-slate-800">
                                      {l.descripcionCargo}
                                    </div>
                                    <div className="text-slate-500">{l.detalleCont}</div>
                                  </td>
                                  <td className="px-5 py-4 text-center text-xs text-slate-600">
                                    {l.diasTrab}d / {l.horas}h
                                  </td>
                                  <td className="px-5 py-4 text-right font-mono text-slate-700">
                                    $ {Number(l.totHaberes).toLocaleString('es-CL')}
                                  </td>
                                  <td className="px-5 py-4 text-right font-mono text-[#EB567F]">
                                    $ {Number(l.totDesctos).toLocaleString('es-CL')}
                                  </td>
                                  <td className="px-5 py-4 text-right font-mono font-bold text-green-700">
                                    $ {Number(l.liquidoPago).toLocaleString('es-CL')}
                                  </td>
                                  <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                                    <button
                                      onClick={() => handleVerDetalleLiquidacion(l.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#e0f2fe] text-[#016098] hover:bg-blue-100 transition"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Ver Detalle
                                    </button>
                                    <a
                                      href={getPdfDownloadUrl(`/liquidaciones/${l.id}/pdf`)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#016098] text-white hover:bg-[#024a8d] transition shadow-sm"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      Descargar PDF
                                    </a>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CERTIFICADO DE ANTIGÜEDAD LABORAL */}
              {tabFuncionario === 'certificados' && (
                <div className="max-w-3xl">
                  <div className="bg-white rounded-xl border border-[#e2e8f0] border-l-4 border-l-[#016098] shadow-sm p-6 flex flex-col justify-between space-y-5">
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#e0f2fe] text-[#016098] flex items-center justify-center">
                        <Award className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-[#016098]">
                        Certificado de Antigüedad Laboral CMDS
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Documento oficial firmado por la Jefatura del Departamento de Recursos Humanos de la Corporación Municipal de Desarrollo Social de Antofagasta, que acredita su fecha de ingreso, calidad contractual, establecimiento, cargo y carga horaria vigente.
                      </p>

                      {infoAntiguedad && infoAntiguedad.contratos?.length > 0 && (
                        <div className="bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0] space-y-2 text-xs">
                          <div className="font-bold text-[#016098] uppercase">
                            Contratos Vigentes ({infoAntiguedad.periodoReferencia}):
                          </div>
                          {infoAntiguedad.contratos.map((c: any) => (
                            <div key={c.id} className="border-t border-slate-200 pt-2">
                              <div className="font-semibold text-slate-900">
                                {c.nomUnidad} — {c.descripcionCargo}
                              </div>
                              <div className="text-slate-500">
                                Calidad: <strong>{c.detalleCont}</strong> · Ingreso CMDS:{' '}
                                <strong>{c.inicioContrato || '-'}</strong> · Jornada:{' '}
                                <strong>{c.horas} hrs</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <a
                      href={getPdfDownloadUrl('/certificados/antiguedad/pdf')}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto sm:self-start bg-[#016098] hover:bg-[#024a8d] text-white font-bold py-3 px-6 rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <Download className="w-4 h-4" />
                      Descargar Certificado de Antigüedad (PDF)
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 3: MIS DATOS PERSONALES Y PREVISIONALES */}
              {tabFuncionario === 'datos' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#016098] font-bold border-b pb-3">
                      <User className="w-5 h-5" />
                      <h4>Identificación Personal</h4>
                    </div>
                    <dl className="space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">RUT:</dt>
                        <dd className="font-bold text-slate-900">{user.rutFmt}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Nombre Completo:</dt>
                        <dd className="font-semibold text-slate-900 text-right">
                          {misDatos?.fichaRemuneraciones?.nombreFmt || user.nombreCompleto}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Fecha Nacimiento / Edad:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.fecNacimiento || '-'} (
                          {misDatos?.fichaRemuneraciones?.edad || '-'} años)
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Estado Civil:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.estadoCivil || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Nacionalidad:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.nacionalidad || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Dirección:</dt>
                        <dd className="font-medium text-slate-800 text-right">
                          {misDatos?.fichaRemuneraciones?.direccion || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Teléfono:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.telefono || user.telefono || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Título / Especialidad:</dt>
                        <dd className="font-medium text-slate-800 text-right">
                          {misDatos?.fichaRemuneraciones?.descTitulo || '-'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#016098] font-bold border-b pb-3">
                      <Briefcase className="w-5 h-5" />
                      <h4>Información Contractual</h4>
                    </div>
                    <dl className="space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Departamento:</dt>
                        <dd className="font-semibold text-slate-900">
                          {misDatos?.fichaRemuneraciones?.nomSucursal || user.departamento || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Unidad / Establecimiento:</dt>
                        <dd className="font-semibold text-slate-900 text-right">
                          {misDatos?.fichaRemuneraciones?.nomUnidad || user.unidad || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Cargo:</dt>
                        <dd className="font-semibold text-slate-900 text-right">
                          {misDatos?.fichaRemuneraciones?.descripcionCargo || user.cargo || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Tipo Contrato:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.detalleCont || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Planta / Categoría:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.planta || '-'} /{' '}
                          {misDatos?.fichaRemuneraciones?.categoria || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Jornada / Horas:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.horas ?? '-'} hrs (
                          {misDatos?.fichaRemuneraciones?.jornada || '-'})
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Fecha Ingreso CMDS:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.inicioContrato || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Bienios Reconocidos:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.bienios ?? 0}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#016098] font-bold border-b pb-3">
                      <HeartPulse className="w-5 h-5" />
                      <h4>Previsión y Forma de Pago</h4>
                    </div>
                    <dl className="space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">A.F.P.:</dt>
                        <dd className="font-semibold text-slate-900">
                          {misDatos?.fichaRemuneraciones?.nomAfp || '-'} (
                          {misDatos?.fichaRemuneraciones?.porcAfp || '0'}%)
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Sistema de Salud:</dt>
                        <dd className="font-semibold text-slate-900">
                          {misDatos?.fichaRemuneraciones?.nomSalud || '-'} (
                          {misDatos?.fichaRemuneraciones?.porcFijoSalud || '0'}%)
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Cargas Familiares:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.nroCargas ?? 0}
                        </dd>
                      </div>
                      <div className="pt-2 border-t flex items-center gap-2 text-[#016098] font-bold">
                        <CreditCard className="w-4 h-4" />
                        <span>Datos Bancarios</span>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Modalidad de Pago:</dt>
                        <dd className="font-semibold text-slate-900">
                          {misDatos?.fichaRemuneraciones?.formaPago || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Institución Bancaria:</dt>
                        <dd className="font-medium text-slate-800">
                          {misDatos?.fichaRemuneraciones?.razonSocialBanco || '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">N° de Cuenta:</dt>
                        <dd className="font-mono font-semibold text-slate-900">
                          {misDatos?.fichaRemuneraciones?.nroCuenta || '-'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {/* TAB 4: CONTACTAR A RRHH */}
              {tabFuncionario === 'mensajes' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6">
                    <h3 className="text-base font-bold text-[#016098] mb-1">
                      Enviar Consulta o Solicitud a Recursos Humanos
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Su mensaje quedará registrado directamente en la bandeja de atención del Departamento de Recursos Humanos CMDS.
                    </p>

                    <form onSubmit={handleEnviarMensaje} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                          Su Correo Electrónico de Contacto *
                        </label>
                        <input
                          type="email"
                          required
                          value={emailContacto}
                          onChange={(e) => setEmailContacto(e.target.value)}
                          placeholder="ejemplo@cmds.cl"
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#016098]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                          Detalle de su Consulta o Solicitud *
                        </label>
                        <textarea
                          rows={5}
                          required
                          value={textoMensaje}
                          onChange={(e) => setTextoMensaje(e.target.value)}
                          placeholder="Escriba aquí su consulta sobre remuneraciones, contratos, certificados o licencias..."
                          className="w-full rounded-lg border border-gray-300 p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#016098]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={enviandoMensaje}
                        className="bg-[#016098] hover:bg-[#024a8d] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        {enviandoMensaje ? 'Enviando mensaje...' : 'Enviar Mensaje a RRHH'}
                      </button>
                    </form>
                  </div>

                  <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 space-y-4">
                    <h3 className="text-base font-bold text-[#016098]">
                      Mis Consultas Enviadas ({misMensajes.length})
                    </h3>
                    {misMensajes.length === 0 ? (
                      <p className="text-xs text-slate-500 py-8 text-center">
                        No registra consultas enviadas anteriormente.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                        {misMensajes.map((m) => (
                          <div
                            key={m.id}
                            className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">
                                {new Date(m.fechaEnvio).toLocaleString('es-CL')}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                  m.estado === 'LEIDO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {m.estado === 'LEIDO' ? 'Revisado por RRHH' : 'En Revisión'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 whitespace-pre-line">{m.mensaje}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SEGURIDAD Y CONTRASEÑA */}
              {tabFuncionario === 'seguridad' && (
                <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 max-w-3xl">
                  <h3 className="text-base font-bold text-[#016098] mb-1">
                    Actualización de Contraseña y Preguntas de Seguridad
                  </h3>
                  <p className="text-xs text-slate-500 mb-6">
                    Actualice su clave de acceso y defina sus 3 preguntas secretas para recuperación automática de contraseña.
                  </p>

                  <form onSubmit={handleGuardarClaveYPreguntas} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {!user.esNuevo && (
                        <div>
                          <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                            Contraseña Actual
                          </label>
                          <input
                            type="password"
                            value={passwordActual}
                            onChange={(e) => setPasswordActual(e.target.value)}
                            placeholder="Contraseña actual"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                          Nueva Contraseña *
                        </label>
                        <input
                          type="password"
                          required
                          minLength={4}
                          value={nuevaPassword}
                          onChange={(e) => setNuevaPassword(e.target.value)}
                          placeholder="Mínimo 4 caracteres"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                          Confirmar Nueva Contraseña *
                        </label>
                        <input
                          type="password"
                          required
                          minLength={4}
                          value={confirmarPassword}
                          onChange={(e) => setConfirmarPassword(e.target.value)}
                          placeholder="Repita la nueva contraseña"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#016098] uppercase mb-1">
                        Correo Electrónico Personal / Institucional
                      </label>
                      <input
                        type="email"
                        value={emailContacto}
                        onChange={(e) => setEmailContacto(e.target.value)}
                        placeholder="correo@ejemplo.cl"
                        className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#016098]">
                        Preguntas de Seguridad para Recuperación de Clave (Opcional si ya las tiene configuradas)
                      </h4>

                      {preguntasForm.map((pf, idx) => (
                        <div key={pf.orden} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Pregunta #{pf.orden}
                            </label>
                            <select
                              value={pf.codigo}
                              onChange={(e) => {
                                const copia = [...preguntasForm];
                                copia[idx].codigo = e.target.value;
                                setPreguntasForm(copia);
                              }}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            >
                              {catalogoPreguntas.map((cp) => (
                                <option key={cp.codigo} value={cp.codigo}>
                                  {cp.pregunta}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Respuesta #{pf.orden}
                            </label>
                            <input
                              type="text"
                              value={pf.respuesta}
                              onChange={(e) => {
                                const copia = [...preguntasForm];
                                copia[idx].respuesta = e.target.value;
                                setPreguntasForm(copia);
                              }}
                              placeholder="Escriba su respuesta..."
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="bg-[#016098] hover:bg-[#024a8d] text-white font-bold px-6 py-2.5 rounded-lg text-sm shadow-sm"
                    >
                      Guardar Contraseña y Configuración de Seguridad
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL PREVISUALIZACIÓN DETALLE DE LIQUIDACIÓN */}
      {(detalleModal || loadingDetalle) && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#016098] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  Liquidación de Sueldo — {detalleModal?.personal?.periodoFmt || 'Cargando...'}
                </h3>
                {detalleModal?.personal && (
                  <p className="text-xs text-blue-200">
                    {detalleModal.personal.nombreFmt} ({detalleModal.personal.rutFmt}) ·{' '}
                    {detalleModal.personal.nomUnidad}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detalleModal?.personal && (
                  <a
                    href={getPdfDownloadUrl(`/liquidaciones/${detalleModal.personal.id}/pdf`)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#39BABD] hover:bg-[#2c989b] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Descargar PDF Oficial
                  </a>
                )}
                <button onClick={() => setDetalleModal(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDetalle || !detalleModal ? (
              <div className="p-12 text-center text-slate-500">
                Cargando desglose de haberes y descuentos...
              </div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0]">
                  <div>
                    <span className="text-slate-400 block">Cargo</span>
                    <strong className="text-slate-800">
                      {detalleModal.personal.descripcionCargo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Calidad / Horas</span>
                    <strong className="text-slate-800">
                      {detalleModal.personal.detalleCont} ({detalleModal.personal.horas} hrs)
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">AFP / Salud</span>
                    <strong className="text-slate-800">
                      {detalleModal.personal.nomAfp} / {detalleModal.personal.nomSalud}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Renta Imponible / Tributable</span>
                    <strong className="text-slate-800 font-mono">
                      ${Number(detalleModal.personal.montoImponi).toLocaleString('es-CL')} / $
                      {Number(detalleModal.personal.tributa).toLocaleString('es-CL')}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Columna Haberes */}
                  <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                    <div className="bg-[#016098] text-white px-4 py-2 font-bold flex justify-between">
                      <span>DETALLE DE HABERES</span>
                      <span>MONTO $</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {detalleModal.haberes.map((h: any, idx: number) => (
                        <div key={idx} className="px-4 py-2 flex justify-between hover:bg-slate-50">
                          <span className="text-slate-700">
                            <span className="font-mono text-slate-400 mr-2">{h.codigo}</span>
                            {h.concepto}
                          </span>
                          <span className="font-mono font-semibold text-slate-900">
                            $ {Number(h.monto).toLocaleString('es-CL')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Columna Descuentos */}
                  <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                    <div className="bg-slate-700 text-white px-4 py-2 font-bold flex justify-between">
                      <span>DETALLE DE DESCUENTOS</span>
                      <span>MONTO $</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {detalleModal.descuentos.map((d: any, idx: number) => (
                        <div key={idx} className="px-4 py-2 flex justify-between hover:bg-slate-50">
                          <span className="text-slate-700">
                            <span className="font-mono text-slate-400 mr-2">{d.codigo}</span>
                            {d.concepto}
                          </span>
                          <span className="font-mono font-semibold text-[#EB567F]">
                            $ {Number(d.monto).toLocaleString('es-CL')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Totales */}
                <div className="bg-[#016098] text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="flex gap-6">
                    <div>
                      <span className="text-blue-200 block text-[11px]">TOTAL HABERES</span>
                      <span className="font-mono font-bold text-sm">
                        $ {Number(detalleModal.personal.totHaberes).toLocaleString('es-CL')}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-200 block text-[11px]">TOTAL DESCUENTOS</span>
                      <span className="font-mono font-bold text-sm text-rose-200">
                        $ {Number(detalleModal.personal.totDesctos).toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white text-[#016098] px-5 py-2 rounded-lg text-right shadow-sm">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">
                      LÍQUIDO A PAGAR
                    </span>
                    <span className="font-mono font-extrabold text-lg">
                      $ {Number(detalleModal.personal.liquidoPago).toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
