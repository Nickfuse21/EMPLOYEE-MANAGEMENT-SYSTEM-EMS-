# --- Backend image: Node.js API ---
FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package files change.
COPY package*.json ./
RUN npm install --omit=dev

# Copy the application source.
COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
