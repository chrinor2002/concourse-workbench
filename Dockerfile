FROM node:4-onbuild

# NOTE: JS_* are exposed in the front end JS
ENV JS_INTERVAL 8000
#ENV JS_JOB_NAME_REGEX ^.*$
#ENV JS_JOB_NAME_REGEX_FLAGS i
#ENV CONCOURSE_URL_PROTOCOL https
ENV CONCOURSE_URL_HOST concourse.example.com

RUN mkdir -p /concourse-workbench/
WORKDIR /concourse-workbench/

COPY package.json /concourse-workbench/
RUN npm install

COPY . /concourse-workbench/

EXPOSE 8888
CMD [ "npm", "start" ]