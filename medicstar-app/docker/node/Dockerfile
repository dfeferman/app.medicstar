FROM node:20-alpine
LABEL image-name=medicstar
EXPOSE 3000

RUN npm install -g pm2
WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm cache clean --force
RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

CMD ["npm", "run", "docker-start"]
