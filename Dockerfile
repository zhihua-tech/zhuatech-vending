FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p data
EXPOSE 18105
CMD ["node", "src/server.js"]
