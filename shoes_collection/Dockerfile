FROM node:24.22.2-bookworm-slim

WORKDIR /opt/shoes
ENV NODE_ENV=production
COPY package.json server.mjs run.mjs LUCIDE-LICENSE.txt ./
COPY src/ ./src/
COPY ui/ ./ui/
COPY drizzle/ ./drizzle/
RUN node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; new DatabaseSync(':memory:').close()"

LABEL io.hass.name="Shoes Collection" \
      io.hass.description="Private shoe collection with persistent photos and database" \
      io.hass.version="1.6.2" \
      io.hass.type="addon" \
      io.hass.arch="aarch64|amd64"
EXPOSE 8099
CMD ["node", "run.mjs"]
