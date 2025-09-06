FROM apify/actor-node-playwright:latest

# copie
COPY . ./

# installe avec les devDependencies (typescript, etc.)
RUN npm ci --include=dev || npm install --include=dev

# compile TS -> dist/
RUN npm run build

# lance le JS compilé
CMD ["node", "dist/main.js"]
