FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy configurations
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose server port
EXPOSE 5000

# Run in production mode
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
