FROM node:22-alpine

WORKDIR /app

# Copia só os arquivos de dependências primeiro (aproveita o cache do Docker)
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
