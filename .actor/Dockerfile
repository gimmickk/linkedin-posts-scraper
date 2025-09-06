FROM apify/actor-node-playwright:latest

COPY . ./

RUN npm install

# Ajout : installation de tsx globalement
RUN npm install -g tsx

CMD ["tsx", "src/main.ts"]
