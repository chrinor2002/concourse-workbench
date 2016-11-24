FROM node:4-onbuild

RUN mkdir -p /concourse-nats/
WORKDIR /concourse-nats/

COPY package.json /concourse-nats/
RUN npm install

COPY . /concourse-nats/

EXPOSE 8888
CMD [ "npm", "start" ]