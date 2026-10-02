FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server code
COPY server/ ./server/

WORKDIR /app/server

ENTRYPOINT ["node", "bridge.js"]
