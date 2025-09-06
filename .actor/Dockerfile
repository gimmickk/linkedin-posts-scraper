FROM apify/actor-node-playwright:latest

COPY . ./
RUN npm install

CMD ["npx", "tsx", "src/main.ts"]
