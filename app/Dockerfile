FROM node:20-alpine
WORKDIR /app
COPY stacks/shroom/app/package*.json ./
RUN npm ci --omit=dev
COPY stacks/shroom/app/ .
COPY design/kit/ ./public/kit/
EXPOSE 3000
CMD ["node", "server.js"]
