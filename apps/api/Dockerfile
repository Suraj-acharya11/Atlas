FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @atlas/api build
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app ./
RUN apk add --no-cache python3 py3-pip && pip3 install --no-cache-dir -r services/doc-extractor/requirements.txt --break-system-packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 3000
CMD ["node","apps/api/dist/src/main.js"]
