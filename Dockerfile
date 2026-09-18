# Reference Dockerfile for the Next.js frontend/API (the implementation that
# actually powers this workspace's live preview). Not used by the sandbox's
# managed build/start flow, but provided for standalone Docker/Render/
# Railway deployment.
FROM node:20-alpine AS base

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx next typegen && npm run build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
