# ----------------------------
# Stage 1: Build the TypeScript app
# ----------------------------
FROM node:18-alpine AS builder

# set working directory inside container
WORKDIR /app

# copy package files first (for caching)
COPY package*.json ./

# install dependencies (all, including dev for tsc)
RUN npm install

# copy tsconfig and source code
COPY tsconfig.json ./
COPY src ./src

# build TypeScript -> dist/
RUN npm run build

# ----------------------------
# Stage 2: Run the compiled app
# ----------------------------
FROM node:18-alpine AS runtime

WORKDIR /app

# copy only package files and install prod dependencies
COPY package*.json ./
RUN npm install --omit=dev

# copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# set env
ENV NODE_ENV=production
EXPOSE 8080

# run app
CMD ["node", "dist/index.js"]
