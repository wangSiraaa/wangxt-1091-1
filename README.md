# 医院床旁陪检系统

## 项目简介

医院床旁陪检全栈应用，基于 Node.js + 前端框架开发。

## 启动方式

### 方式一：npm 启动

#### 1. 安装依赖

```bash
npm run install:all
```

#### 2. 开发模式启动

```bash
npm run dev
```

该命令会同时启动后端（端口 3001）和前端开发服务器。

#### 3. 生产模式构建与启动

```bash
# 构建前后端
npm run build

# 启动后端服务
npm start
```

访问地址：http://localhost:3001

---

### 方式二：Docker 启动

#### 1. 使用 docker-compose 启动（推荐）

```bash
# 构建并启动容器
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止容器
docker-compose down
```

#### 2. 单独使用 Docker 启动

```bash
# 构建镜像
docker build -t hospital-bedside-check .

# 运行容器（挂载数据卷持久化 SQLite 数据库）
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  --name hospital-bedside-check \
  hospital-bedside-check
```

访问地址：http://localhost:3001

## 数据持久化

SQLite 数据库文件存储在容器内 `/app/data` 目录，通过 Docker 卷挂载持久化，避免容器删除后数据丢失。
