#docker build --no-cache --force-rm=true -t inv-observer .
#docker save rep-exporter > rep-exporter.tar
#cat rep-exporter.tar | docker load
#docker run -d --env-file .env --name rep-exporter 93be8a8b1316
FROM oraclelinux:7-slim

ARG CREATED_DATE=30.09.2021
ARG SOURCE_COMMIT=30.09.2021

LABEL org.opencontainers.image.authors=Dom137
LABEL org.opencontainers.image.created=$CREATED_DATE
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.title="inv-observer"
LABEL org.opencontainers.image.url=https://hub.docker.com/r/
LABEL org.opencontainers.image.licenses=Apache-2.0

WORKDIR /node

COPY ./ .

RUN yum -y install oracle-nodejs-release-el7 oracle-instantclient-release-el7 && \
    yum-config-manager --disable ol7_developer_nodejs12 && \
    yum-config-manager --enable ol7_developer_nodejs16 && \
    yum -y install nodejs node-oracledb-node16 && \
    rm -rf /var/cache/yum/* &&  npm install 


ENV NODE_PATH=/usr/lib/node_modules

CMD ["node", "app.js"]