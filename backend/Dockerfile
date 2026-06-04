FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspace @careercenter/api --workspace @careercenter/shared

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY backend/ backend/
COPY scripts/ scripts/
RUN npm run db:generate --workspace @careercenter/api
RUN npm run build --workspace @careercenter/shared
RUN npm run build --workspace @careercenter/api

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/backend/package.json backend/
COPY --from=build /app/packages/shared/package.json packages/shared/
RUN npm install --omit=dev --workspace @careercenter/api --workspace @careercenter/shared
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/scripts scripts/
EXPOSE 3000
CMD ["npm", "run", "start:prod", "--workspace", "@careercenter/api"]
