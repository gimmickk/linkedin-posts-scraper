FROM apify/actor-node-playwright:latest

# copier le code
COPY . ./

# installer les deps
RUN npm ci || npm install

# compiler TypeScript -> dist/
RUN npm run build

# lancer le JS compilé
CMD ["node", "dist/main.js"]
