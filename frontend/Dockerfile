FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace @careercenter/web --workspace @careercenter/shared

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY frontend/ frontend/
RUN npm run build --workspace @careercenter/shared
RUN npm run build --workspace @careercenter/web

FROM nginx:alpine AS runtime
ENV API_UPSTREAM=careercenter.railway.internal:3000
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
