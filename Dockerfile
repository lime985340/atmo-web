FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_KAKAO_APP_KEY

COPY package*.json ./
RUN npm install

COPY . .
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_KAKAO_APP_KEY=${VITE_KAKAO_APP_KEY}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
