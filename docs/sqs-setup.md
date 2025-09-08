# SQS Setup

## Content Entity Scene

These are the entities that contain all the necessary information to create each of the Places. By means of a SQS queue the EntityId and the Url of the Content server are obtained in order to obtain the information.

## Prerequisites

Please make sure to install the following tools on your machine:

- python (Python 3.7 up to 3.10 is supported)
- pip (Python package manager)  
- docker

## Installation

Install localstack using the Python package manager:

```bash
python3 -m pip install localstack
```

Then follow the steps to install the [awslocal](https://docs.localstack.cloud/user-guide/integrations/aws-cli/).

## Run

After opening Docker, start localstack:

```bash
localstack start -d
```

Then create the sqs queue to use:

```bash
awslocal sqs create-queue --queue-name places_test
```

This will return the url of the queue:

```json
{
    "QueueUrl": "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/places_test"
}
```

## Message Format

The message to be received from the SQS must have the following format:

```json
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

## Sending Messages

Send a message using awslocal:

```bash
awslocal sqs send-message --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/places_test --message-body '{"Message":"{\"entity\":{\"entityId\":\"bafkreietumuqvq6kyy5k3dnn4z57j45isf5e2rjn46w2hrcpfghwmausvy\",\"authChain\":\"authChain\"},\"contentServerUrls\":[\"https://peer.decentraland.org/content\"]}"}'
```

This will return a JSON with the message id:

```json
{
  "MD5OfMessageBody": "c2bdcb767c73f8afeac400d8f738749d",
  "MessageId": "c17636c0-f37e-4c6f-a4ab-112fa250a8c6"
}
```

## Checking Messages

To return the messages in the SQS, execute a curl command:

```bash
curl -H "Accept: application/json" \
    "http://localhost:4566/_aws/sqs/messages?QueueUrl=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/places_test"
```

## Purging Queue

To purge the SQS:

```bash
awslocal sqs purge-queue --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/places_test
```
