FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm --workspace @weathertrip/shared run build
RUN npm --workspace @weathertrip/api run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/services/api ./services/api
EXPOSE 4100
CMD ["npm", "--workspace", "@weathertrip/api", "run", "start"]
