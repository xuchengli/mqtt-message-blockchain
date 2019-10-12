FROM node:8.12
MAINTAINER li xu cheng "lixucheng@zhigui.com"

ENV WORK_DIR /usr/app/src

RUN mkdir -p ${WORK_DIR}
WORKDIR ${WORK_DIR}

COPY package.json ${WORK_DIR}
RUN npm install

COPY . ${WORK_DIR}
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
