# Production Build für React/Vite + nginx
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
RUN npm install jwt-decode
RUN npm install --save-dev @types/jwt-decode
# Install MUI, emotion, and react dependencies for build
RUN npm install @mui/material @mui/icons-material @emotion/react @emotion/styled react
RUN npm install --save-dev @types/react
RUN npm install --save-dev @types/react @types/react-dom
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY --from=build /app/public ./public
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 1105
CMD ["nginx", "-g", "daemon off;"]
