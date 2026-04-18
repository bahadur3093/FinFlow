FROM node:22-slim

# Install qpdf for PDF decryption
RUN apt-get update && \
    apt-get install -y --no-install-recommends qpdf openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 5000

CMD ["npm", "start"]
