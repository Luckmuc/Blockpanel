# Production Build für React/Vite + nginx
FROM node:20-slim AS build
WORKDIR /app

# Set Node.js memory limit to prevent out-of-memory issues
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies in one step to optimize layer caching
RUN npm ci --only=production=false \
    && npm install jwt-decode \
    && npm install --save-dev @types/jwt-decode \
    && npm install @mui/material @mui/icons-material @emotion/react @emotion/styled react \
    && npm install --save-dev @types/react @types/react-dom \
    && npm install axios

# Copy source code
COPY . .

# Build the application
RUN npm run build

FROM nginx:1.25-alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY --from=build /app/public ./public
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 1105
CMD ["nginx", "-g", "daemon off;"]
