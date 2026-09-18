FROM golang:1.26-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/cartrune-api ./cmd/api

FROM alpine:3.22
RUN adduser -D -u 10001 cartrune
WORKDIR /app
COPY --from=build /out/cartrune-api /app/cartrune-api
USER cartrune
EXPOSE 8080
ENTRYPOINT ["/app/cartrune-api"]
