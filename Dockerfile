# Basis-Image wählen (z.B. node:18-alpine für Stremio-Addons)
FROM node:24-alpine

# Arbeitsverzeichnis festlegen
WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Restlichen Code kopieren
COPY . .

# Port freigeben (Standard bei Stremio-Addons ist oft 3000 oder 7000)
EXPOSE 7000
USER node

# Startbefehl
CMD ["npm", "start"]
