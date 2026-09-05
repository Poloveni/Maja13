FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY . /app
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
