#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE INSTALACIÓN Y DESPLIEGUE EN PRODUCCIÓN LINUX (UBUNTU / DEBIAN / RHEL)
# Portal del Funcionario - Totem Web CMDS 2026
# ==============================================================================

set -e

APP_DIR="/var/www/totem-cmds"
UPLOAD_DIR="/var/www/totem-cmds/uploads"
DB_NAME="totem_cmds"
DB_USER="totem_user"
DB_PASS="CmdsTotem2026_Prod!"
DOMAIN_NAME="totem.cmds.cl"

echo "=============================================================="
echo " 1. Instalando dependencias del sistema, Node.js 22, PostgreSQL y Nginx"
echo "=============================================================="

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y curl git unzip build-essential nginx postgresql postgresql-contrib
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y curl git unzip gcc-c++ make nginx postgresql-server postgresql-contrib
  sudo postgresql-setup --initdb || true
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo dnf install -y nodejs
  fi
fi

sudo npm install -g pm2
sudo systemctl enable --now postgresql
sudo systemctl enable --now nginx

echo "=============================================================="
echo " 2. Configurando Base de Datos PostgreSQL (${DB_NAME})"
echo "=============================================================="

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

if [ -f "./totem_cmds_2026.sql.gz" ]; then
  echo "Restaurando volcado comprimido totem_cmds_2026.sql.gz en ${DB_NAME}..."
  zcat ./totem_cmds_2026.sql.gz | sudo -u postgres psql -d "${DB_NAME}"
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
elif [ -f "./totem_cmds_2026.sql" ]; then
  echo "Restaurando volcado totem_cmds_2026.sql en ${DB_NAME}..."
  sudo -u postgres psql -d "${DB_NAME}" -f ./totem_cmds_2026.sql
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};"
  sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};"
fi

echo "=============================================================="
echo " 3. Configurando aplicación en ${APP_DIR}"
echo "=============================================================="

sudo mkdir -p "${APP_DIR}"
sudo mkdir -p "${UPLOAD_DIR}"
sudo chown -R "$USER:$USER" "${APP_DIR}"

# Si el script se ejecuta desde la carpeta deploy-produccion dentro del proyecto, copiar backend y frontend
if [ -d "../backend" ] && [ -d "../frontend" ]; then
  cp -r ../backend "${APP_DIR}/"
  cp -r ../frontend "${APP_DIR}/"
fi

cat > "${APP_DIR}/backend/.env" <<EOF
PORT=4000
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
JWT_SECRET="totem_cmds_2026_prod_secret_$(openssl rand -hex 16)"
UPLOAD_DIR="${UPLOAD_DIR}"
EOF

cd "${APP_DIR}/backend"
npm install
npx prisma generate
pm2 delete totem-cmds-api >/dev/null 2>&1 || true
pm2 start npm --name "totem-cmds-api" --cwd "${APP_DIR}/backend" -- run start
pm2 save

cd "${APP_DIR}/frontend"
npm install
npm run build

echo "=============================================================="
echo " 4. Configurando Reverse Proxy Nginx (${DOMAIN_NAME})"
echo "=============================================================="

NGINX_CONF="/etc/nginx/conf.d/totem-cmds.conf"
sudo tee "${NGINX_CONF}" > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME} _;

    client_max_body_size 100M;

    root ${APP_DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:4000/assets/;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx

echo "=============================================================="
echo " ¡DESPLIEGUE COMPLETADO CON ÉXITO!"
echo " - Portal Web disponible en: http://${DOMAIN_NAME}"
echo " - API Backend activa en PM2: totem-cmds-api (puerto 4000)"
echo " - Base de datos PostgreSQL : ${DB_NAME}"
echo "=============================================================="
