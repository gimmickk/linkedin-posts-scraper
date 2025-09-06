FROM apify/actor-node-playwright:latest

COPY . ./

# Installation des dépendances locales (tsx est déjà dans package.json)
RUN npm install

CMD ["npx", "tsx", "src/main.ts"]
