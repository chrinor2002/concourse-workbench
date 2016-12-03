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

# Env Variables

| Variable                | Required | Description                                                                                                                                                                                                                                                                                               |
|-------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| JS_INTERVAL             | No       | Controls the interval for a refresh of pipe status indicators. Note: the more pipelines you have the higher I would recommend this number be.                                                                                                                                                             |
| JS_JOB_NAME_REGEX       | No       | Controls a regex pattern to match job names against. If a job does not match this pattern it is ignored. A good use case for this when a job exists, such as checking pull requests, and it is expected to fail periodically, but its failure does not represent a failure of the main build job or jobs. |
| JS_JOB_NAME_REGEX_FLAGS | No       | Allows flags such as "i" to be set for the job name reject                                                                                                                                                                                                                                                |
| CONCOURSE_URL_PROTOCOL  | No       | Sets the concourse url protocol. This should always be set to https, unless you are running this tool internally and really need http.                                                                                                                                                                    |
| CONCOURSE_URL_HOST      | Yes      | Sets the concourse url host. eg. concourse.yourcompany.com                                                                                                                                                                                                                                                |
|                         |          |                                                                                                                                                                                                                                                                                                           |

# Unsupported (right now)
- Running a monitor against a concourse instance running within a directory eg. http://127.0.0.1/concourse/
