FROM node:8.12
MAINTAINER li xu cheng "lixucheng@zhigui.com"

ENV WORK_DIR /usr/app/src

RUN mkdir -p ${WORK_DIR}
WORKDIR ${WORK_DIR}

COPY package.json ${WORK_DIR}
RUN npm install --production

COPY . ${WORK_DIR}
RUN npm run build

CMD ["npm", "start"]
