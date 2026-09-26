FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY public ./public
COPY master ./master
COPY scripts/build-portable.mjs ./scripts/build-portable.mjs
COPY index.html tsconfig.json vite.config.ts ./
RUN npm run build:portable

FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY server ./server
RUN CGO_ENABLED=0 go build -trimpath -o /infra-rush ./server

FROM alpine:3.21
WORKDIR /app
COPY --from=web /app/dist ./dist
COPY master ./master
COPY --from=backend /infra-rush /infra-rush
EXPOSE 8080
CMD ["/infra-rush", "-static", "/app/dist", "-master", "/app/master"]
