# 第一阶段：构建前端
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# 第二阶段：构建后端
FROM node:18-alpine AS backend-build

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

# 第三阶段：运行阶段
FROM node:18-alpine AS production

WORKDIR /app

COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules

COPY --from=frontend-build /app/frontend/dist ./dist/public

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
