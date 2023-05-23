# Places

[![Coverage Status](https://coveralls.io/repos/github/decentraland/places/badge.svg?branch=master)](https://coveralls.io/github/decentraland/places?branch=master)

Brief description of this project.

![decentraland](https://decentraland.org/images/fallback-hero.jpg)

## Setup

### environment setup

create a copy of `.env.example` and name it as `.env.development`

```bash
  cp .env.example .env.development
```

> to know more about this file see [the documentation](https://www.gatsbyjs.com/docs/how-to/local-development/environment-variables/#defining-environment-variables)

if you are running this project locally you only need to check the following environment variables:

- `CONNECTION_STRING`: make sure it is point to a valid database

### database setup

once you have a `CONNECTION_STRING` you can setup you database tables using the following command

```bash
npm run migrate up
```

### clear database

to clear database to restart the project as is where new run the following SQL

```SQL
truncate places;
truncate place_activities;
truncate place_activity_daily;
truncate entities_places;
truncate tasks;
update deployment_tracks set "from" = 0;
```

## Run

once you setup this project you can start it using the following command

```bash
  npm start
```

> Note 1: this project run over `https`, if it is your first time you might need to run it with `sudo`

> Note 2: you can disabled `https` removing the `--https` flag in the `develop` script of your `package.json`

## Project's structure

You can find a full documentation about the project's structure in the [`decentraland-gatsby` repository](https://github.com/decentraland/decentraland-gatsby#project-structure)

### back and front ends

this project runs gatsby as front-end and a nodejs server as back-end both connected through a proxy

- locally this proxy is defined in [`gatsby-config.js` (`proxy` prop)](https://www.gatsbyjs.com/docs/api-proxy/#gatsby-skip-here)
- at servers this proxy is defined in `Pulumi.ts` (`servicePaths` prop)

### routes

**front-end** routes are defined using [gatsby routes](https://www.gatsbyjs.com/docs/reference/routing/creating-routes/#define-routes-in-srcpages) + [gatsby-plugin-intl](https://www.gatsbyjs.com/plugins/gatsby-plugin-intl/?=gatsby-plugin-intl), you can find each page in the `src/pages` directory

**back-end** routes are defined using `express` you can find each route in `src/entities/{Entity}/routes.ts` and those are imported ar `src/server.ts`

## Re-Populate `place_positions`

```sql
TRUNCATE "place_positions";
INSERT INTO "place_positions" ("base_position", "position")
  SELECT p.base_position, unnest(p.positions) FROM places p
    WHERE p.disabled IS FALSE
      AND p.world    IS FALSE
```

## Content Entity Scene

These are the entities that contain all the necessary information to create each of the Places. By means of a SQS queue the EntityId and the Url of the Content server are obtained in order to obtain the information. Next we are going to describe the steps to test this locally.

### Install local SQS

To do this you will need [Localstack](https://docs.localstack.cloud/).

### Prerequisites

Please make sure to install the following tools on your machine before moving ahead:

```
python (Python 3.7 up to 3.10 is supported)
pip (Python package manager)
docker
```

### Installation

Install localstack using the Python package manager.

```
$ python3 -m pip install localstack
```

Then follow the steps to install the [awslocal](https://docs.localstack.cloud/user-guide/integrations/aws-cli/).

### Run

After opening the Docker, start the localstack

```
localstack start -d
```

Then create the sqs queue to use

```
awslocal sqs create-queue --queue-name places_test
```

This will return the url of the queue

```
{
    "QueueUrl": "http://localhost:4566/000000000000/places_test"
}
```

### Usage

The message to be received from the SQS must be sent using `awslocal`. This message must have the following format

```
{
  "Message": {
    "entity": {
        "entityId": "bafkreietumuqvq6kyy5k3dnn4z57j45isf5e2rjn46w2hrcpfghwmausvy",
        "authChain": "authChain"
    },
    "contentServerUrls": ["https://peer.decentraland.org/content"]
  }
}
```

And this must be sent as a message body like this using awslocal `awslocal sqs send-message --queue-url {queue-url} --message-body {message}` like:

```
$ awslocal sqs send-message --queue-url http://localhost:4566/00000000000/places_test --message-body '{"Message":"{\"entity\":{\"entityId\":\"bafkreietumuqvq6kyy5k3dnn4z57j45isf5e2rjn46w2hrcpfghwmausvy\",\"authChain\":\"authChain\"},\"contentServerUrls\":[\"https://peer.decentraland.org/content\"]}"}'
```

This will answer with a JSON with the message id like

```
{
  "MD5OfMessageBody": "c2bdcb767c73f8afeac400d8f738749d",
  "MessageId": "c17636c0-f37e-4c6f-a4ab-112fa250a8c6"
}
```

To return the messages set in the SQS, a curl command can be executed `http://localhost:4566/_aws/sqs/messages?QueueUrl={queue-url}` like:

```
$ curl -H "Accept: application/json" \
    "http://localhost:4566/_aws/sqs/messages?QueueUrl=http://queue.localhost.localstack.cloud:4566/000000000000/places_test"
```

And the response should be something like

```
{
  "ReceiveMessageResponse":{
    "ReceiveMessageResult":{
        "Message":{
          "MessageId":"9a192624-b5b3-44e7-907e-0f5a5458ccb5",
          "MD5OfBody":"c2bdcb767c73f8afeac400d8f738749d",
          "Body":"{Message:{\\entity\\:{\\entityId\\:\\bafkreietumuqvq6kyy5k3dnn4z57j45isf5e2rjn46w2hrcpfghwmausvy\\,\\authChain\\:\\authChain\\},\\contentServerUrls\\:[\\https://peer.decentraland.org/content\\]}}",
          "Attribute":[
              {
                "Name":"SenderId",
                "Value":"000000000000"
              },
              {
                "Name":"SentTimestamp",
                "Value":"1679598003529"
              },
              {
                "Name":"ApproximateReceiveCount",
                "Value":"0"
              },
              {
                "Name":"ApproximateFirstReceiveTimestamp",
                "Value":"1679598013330"
              }
          ],
          "ReceiptHandle":"SQS/BACKDOOR/ACCESS"
        }
    },
    "ResponseMetadata":{
        "RequestId":"DN4HZ3U16MG9FHFY2G48IXBZUI721VFFUQ9SWEZFKIS79VGMG7XN"
    }
  }
}
```

Finally to purge the SQS `awslocal sqs purge-queue --queue-url {queue_url}`

```
$ awslocal sqs purge-queue --queue-url http://localhost:4566/00000000000/places_test
```
