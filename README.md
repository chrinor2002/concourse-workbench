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

There are two types of variables:

1. JS_* - these are env variables that can be set either when using docker run, or in a Dockerfile, and will be exposed to the running application page.

2. CONCOURSE_URL_* - these are env variables used by the internal service to determine where to send requests.

  - *_HOST - sets the hostname to query

  - *_PROTOCOL - can be changed to http, if required


# Unsupported (right now)
- Running a monitor against a concourse instance running within a directory eg. http://127.0.0.1/concourse/
