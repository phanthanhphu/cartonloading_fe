# syntax=docker/dockerfile:1.7

# ===== BUILD STAGE =====
FROM node:20-alpine AS build

WORKDIR /app

# Copy package trước để Docker cache dependency
COPY package.json package-lock.json ./

# package-lock hiện chưa đồng bộ với package.json
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --no-audit --progress=false

# Copy source sau cùng
COPY . .

ARG VITE_APP_VERSION=v1.0.0
ARG VITE_APP_BASE_NAME=/
ARG VITE_APP_PROTOCOL=http
ARG VITE_APP_HOST=10.232.100.69
ARG VITE_API_PORT=8083
ARG VITE_API_BASE_URL=http://10.232.100.69:8083

ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_APP_BASE_NAME=$VITE_APP_BASE_NAME
ENV VITE_APP_PROTOCOL=$VITE_APP_PROTOCOL
ENV VITE_APP_HOST=$VITE_APP_HOST
ENV VITE_API_PORT=$VITE_API_PORT
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


# ===== RUN STAGE =====
FROM nginx:alpine

ARG NGINX_CONF=nginx.http.conf
ARG APP_PORT=80

COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE ${APP_PORT}

CMD ["nginx", "-g", "daemon off;"]