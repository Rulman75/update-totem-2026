# Portal del Funcionario — Totem Web CMDS 2026

Modernización integral del Portal de Autoatención y Gestión de Recursos Humanos (**Totem Web**) de la **Corporación Municipal de Desarrollo Social de Antofagasta (CMDS)**, migrado desde la arquitectura legada (PHP 5.6 / Zend Framework 2 / Oracle 12c) a una arquitectura moderna basada en **React 19 + Vite + Tailwind CSS** y **Node.js + Express + TypeScript + Prisma + PostgreSQL**.

---

## Características Principales

### 1. Portal de Autoatención del Funcionario
* **Autenticación por RUT**: Ingreso de RUT sin puntos ni guión (ej: `12.345.678-9` como `123456789`), con actualización transparente de contraseñas legadas (`MD5`) a `bcrypt`.
* **Liquidaciones de Sueldo — Ventana Histórica de 5 Años Móviles (`2022`–`2026`)**:
  * Selector rápido por año (`2026`, `2025`, `2024`, `2023`, `2022` y vista consolidada `Todos`).
  * **Vista de Tarjetones Mensuales** y **Vista de Tabla Compacta** intercambiables.
  * Previsualización en línea del desglose de Haberes y Descuentos y generación de **PDF Oficial CMDS** (`pdfkit`).
* **Certificado de Antigüedad Laboral CMDS**: Emisión instantánea en PDF firmado con los contratos vigentes del funcionario.
* **Ficha Personal, Contractual y Previsional**: Consulta de datos personales, cargo, unidad, AFP, sistema de salud y modalidad de pago.
* **Bandeja de Consultas a Recursos Humanos**: Envío y seguimiento de solicitudes directamente hacia RRHH.
* **Seguridad y Recuperación de Clave**: Configuración y validación de 3 preguntas de seguridad secretas.

### 2. Panel de Administración RRHH
* **Dashboard de Indicadores**: Estadísticas en tiempo real de funcionarios activos, períodos cargados, consultas pendientes y auditoría.
* **Gestión de Plantillas Mensuales CSV (`Personal` 68 columnas y `Renta` 14 columnas)**:
  * Procesamiento masivo con alta automática de nuevos funcionarios (clave inicial: últimos 4 dígitos del RUT sin DV).
  * Importación directa desde respaldo histórico y caché inteligente bajo demanda en PostgreSQL.
* **Mantenedor de Usuarios**: Búsqueda avanzada, creación/edición de cuentas, cambio de rol (`FUNCIONARIO` / `ADMIN`), bloqueo/desbloqueo, restablecimiento de clave e inspector de documentos por funcionario.
* **Bandeja de Consultas RRHH** y **Bitácora de Auditoría SGSI**.

---

## Estructura del Proyecto

```text
update-totem-2026/
├── backend/                  # API REST (Node.js + Express + TypeScript + Prisma)
│   ├── assets/               # Logos y firmas institucionales para generación de PDFs
│   ├── prisma/
│   │   └── schema.prisma     # Modelo de datos PostgreSQL (9 tablas)
│   ├── scripts/              # Scripts de migración Oracle/CSV y exportación de volcados SQL
│   └── src/
│       ├── server.ts         # Endpoints de Autenticación, Funcionario y Administración
│       ├── services/         # Generador de PDFs (pdf.service.ts) e importador CSV (csv.service.ts)
│       └── utils/            # Utilidades Módulo 11 RUT y criptografía (rut.ts)
├── frontend/                 # SPA (React 19 + Vite + Tailwind CSS + Lucide Icons)
│   ├── public/               # Logos e íconos institucionales CMDS
│   └── src/
│       ├── App.tsx           # Login split-screen y Portal del Funcionario
│       └── components/
│           └── AdminPanel.tsx # Módulo de Administración RRHH
└── deploy-produccion/        # Script automatizado de instalación en servidor Linux
    └── install-linux.sh
```

---

## Ejecución en Desarrollo Local

1. **Backend (`http://localhost:4000`)**:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma generate
   npm run dev
   ```

2. **Frontend (`http://localhost:5173`)**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Despliegue en Servidor Linux (Producción)

En la carpeta `deploy-produccion/` se incluye el instalador automatizado `install-linux.sh` para **Ubuntu/Debian** o **Rocky/AlmaLinux/RHEL**, que configura Node.js 22 LTS, PM2, PostgreSQL, restaura el volcado `totem_cmds_2026.sql.gz` y publica el sitio mediante Nginx.
