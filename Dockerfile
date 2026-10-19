# ---- Compilación ----
FROM node:24-alpine AS compilacion
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- Servidor: nginx sin privilegios (escucha en 8080, no corre como root) ----
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY deploy/nginx/v2.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/seguridad.conf /etc/nginx/seguridad.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html/v2
COPY --chmod=755 deploy/nginx/40-config-v2.sh /docker-entrypoint.d/40-config-v2.sh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/salud || exit 1
