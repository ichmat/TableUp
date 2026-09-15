# syntax=docker/dockerfile:1

# Image TURO : un seul artefact qui contient l'API .NET et le front Angular.
# Contexte de build : source/TURO
#
# Cibles :
#   final     (par défaut) image de production, identique box / hébergé
#   api-dev   dotnet watch, rechargement à chaud
#   front-dev ng serve, rechargement à chaud

ARG NODE_VERSION=24
ARG DOTNET_VERSION=10.0


# ─── Front : dépendances ─────────────────────────────────────────────
# Image glibc (et non alpine) : le lock ne référence que les binaires natifs -gnu
FROM node:${NODE_VERSION}-bookworm-slim AS front-deps
ENV NG_CLI_ANALYTICS=false
WORKDIR /app
COPY TUROApp/package.json TUROApp/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci


# ─── Front : développement ───────────────────────────────────────────
FROM front-deps AS front-dev
COPY TUROApp/ ./
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200"]


# ─── Front : build de production ─────────────────────────────────────
FROM front-deps AS front-build
COPY TUROApp/ ./
RUN npx ng build --configuration production


# ─── API : restauration des paquets ──────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS api-restore
WORKDIR /src
# Le .csproj seul d'abord : la restauration reste en cache tant qu'il ne change pas
COPY TUROAPI/TUROAPI/TUROAPI.csproj TUROAPI/TUROAPI/
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore TUROAPI/TUROAPI/TUROAPI.csproj


# ─── API : développement ─────────────────────────────────────────────
FROM api-restore AS api-dev
COPY TUROAPI/ TUROAPI/
WORKDIR /src/TUROAPI/TUROAPI
ENV ASPNETCORE_ENVIRONMENT=Development \
    ASPNETCORE_URLS=http://+:8080 \
    DOTNET_WATCH_RESTART_ON_RUDE_EDIT=true
EXPOSE 8080
CMD ["dotnet", "watch", "run", "--no-launch-profile", "--non-interactive"]


# ─── API : publication ───────────────────────────────────────────────
FROM api-restore AS api-build
COPY TUROAPI/ TUROAPI/
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet publish TUROAPI/TUROAPI/TUROAPI.csproj \
        -c Release -o /out /p:UseAppHost=false


# ─── Image finale ────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS final
WORKDIR /app
COPY --from=api-build /out ./
# Le front est servi par l'API depuis wwwroot : même origine, pas de CORS
COPY --from=front-build /app/dist/turo/browser ./wwwroot
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "TUROAPI.dll"]
