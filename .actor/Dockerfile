FROM apify/actor-node-playwright:latest

# copie du code
COPY . ./

# installe les deps
RUN npm ci || npm install

# compile TypeScript -> dist/
RUN npm run build

# lance le JS compilé (pas de tsx)
CMD ["node", "dist/main.js"]
