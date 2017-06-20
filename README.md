# concourse-workbench
Provides a one page web application to monitor concourse job states.

# Assumptions
This assumes that the concourse instance you are attempting to monitor is v2.5+ and that it has its API exposed to the system running this docker image.

# tl;dr

## Quick
```
docker run --rm -it -e "CONCOURSE_URL_HOST=concourse.yourcompany.com" -p 8888:8888 chrinor2002/concourse-workbench
```

## Custom Image
```
#!/bin/bash

echo "FROM chrinor2002/concourse-workbench\
ENV CONCOURSE_URL_HOST concourse.yourcompany.com" > Dockerfile
docker build . -t yourcompany/concourse-workbench
docker run --rm -it -p 8888:8888 yourcompany/concourse-workbench
```

# Search Path

A feature was requested that allows an admin to setup pre-filtered pages. The path /search/{substring} allows this.

# Paths
Several paths exist in the server that can be queried:

| Path                    | Description                                                                                                                                                             |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| /                       | The main root of the single page web application.                                                                                                                       |
| /search/{pattern*}      | A secondary single page web application that filters the pipelines. This filter is applied after fetching a list of pipelines, and is applied using substring matching. |
| /e                      | A route defined to allow the main web page to retrieve the environment variables prefixed with JS_.                                                                     |
| /c/{apipath*}           | A route specifically used to forward API requests to concourse.                                                                                                         |
| /c/public/{publicpath*} | A route used for getting public paths from concourse. This is specifically used for fetching CSS and fonts.                                                             |
| /r/{apipath*}           | A route for redirection to concourse. This is used to allow a path returned by concourse to have a relative or absolute location to be redirected to.                   |

# Env Variables

| Variable                | Required | Description                                                                                                                                                                                                                                                                                               |
|-------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| JS_INTERVAL             | No       | Controls the interval for a refresh of pipe status indicators. Note: the more pipelines you have the higher I would recommend this number be.                                                                                                                                                             |
| JS_JOB_NAME_REGEX       | No       | Controls a regex pattern to match job names against. If a job does not match this pattern it is ignored. A good use case for this when a job exists, such as checking pull requests, and it is expected to fail periodically, but its failure does not represent a failure of the main build job or jobs. |
| JS_JOB_NAME_REGEX_FLAGS | No       | Allows flags such as "i" to be set for the job name reject                                                                                                                                                                                                                                                |
| CONCOURSE_URL_PROTOCOL  | No       | Sets the concourse url protocol. This should always be set to https, unless you are running this tool internally and really need http.                                                                                                                                                                    |
| CONCOURSE_URL_HOST      | Yes      | Sets the concourse url host. eg. concourse.yourcompany.com                                                                                                                                                                                                                                                |
| CONCOURSE_BASIC_AUTH    | No       | Sets credentials used for privileged tasks. Note, this is not exposed to the HTML frontend. Users of the frontend are not aware these crednetials exist.                                                                                                                                                  |
| PRIVILEGED_FILTER       | No       | Sets up a whitelist of pipeline jobs and actions that can be taken on them. These tasks are executed using the credentials set using CONCOURSE_BASIC_AUTH                                                                                                                                                 |

For examples of any of these values see the Dockerfile.

# Unsupported (right now)
- Running a monitor against a concourse instance running within a directory eg. http://127.0.0.1/concourse/
