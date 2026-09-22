FROM node:lts-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm i -g corepack@latest
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS dist
ARG BUILD_MODE
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN apk add --no-cache git
RUN pnpm run build --mode=$BUILD_MODE

FROM nginxinc/nginx-unprivileged:latest
ARG ENDPOINT
COPY --from=dist /app/dist /usr/share/nginx/html$ENDPOINT/
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i 's#__ENDPOINT__#'$ENDPOINT'#g' /etc/nginx/conf.d/default.conf
USER nginx

