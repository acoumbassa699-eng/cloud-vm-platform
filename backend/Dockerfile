FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
