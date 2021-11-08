# cdk-pipelines-realworld-example

This repository use [CDK Pipelines](https://docs.aws.amazon.com/cdk/api/latest/docs/pipelines-readme.html) to implement CI/CD for CDK Application.

## Feature

- ####  Directory structure design

Split relevent AWS Service into same directory, such as Network, Ecs etc... See below:

```
project
│   README.md
│   config.yml    
│
└───src
│   │  main.ts 
│   │
│   └───network
│       │   cdk-pipelines.ts
│       │   network-stage.ts
│       │   network-stack.ts
│       │   ...
│       └─── configs
│            │ dev.yml
│            │ prod.yml     
│   └───ecs
│       │   cdk-pipelines.ts
│       │   ecs-stage.ts
│       │   ecs-stack.ts
│       │   ...
│       └─── configs
│            │ dev.yml
│            │ prod.yml  
```

- #### Pre-validation for stack 

When CDK Pipelines cross different account or region for deployment, validate CloudFormation template first which is good way. The benefit is risk reduction that it ensure any modification which be reviewd. The code snippet like blow:

```ts
const ecsWave = pipeline.addWave('Ecs');

ecsWave.addStage(
  new EcsStage(this, 'Dev', {
    env: { account: props.devAccount, region: 'ap-northeast-1' },
    stageEnv: 'dev',
  }),
  {
    pre: [new pipelines.ShellStep('Validate dev CloudFormation Synth', {
      commands: [
        'yarn install --frozen-lockfile',
        './node_modules/.bin/jest --passWithNoTests test/ecs-dev.test.ts',
      ],
    })],
  },
);

ecsWave.addStage(
  new EcsStage(this, 'Production', {
    env: { account: props.prodAccount, region: 'ap-northeast-1' },
    stageEnv: 'prod',
  }),
  {
    pre: [new pipelines.ShellStep('Validate staging CloudFormation Synth', {
      commands: [
        'yarn install --frozen-lockfile',
        './node_modules/.bin/jest --passWithNoTests test/ecs-prod.test.ts',
      ],
    })],
  },
);
```

- #### Fixed CDK version

It can use `cliVersion` prop to specify cdk version. Reference [here](https://github.com/kimisme9386/cdk-pipelines-realworld-example/blob/main/src/ecs/cdk-pipelines.ts#L45)

## Local development and test deployment

When modify code of stack, it's good way for using `cdk diff` to review what the modification. The command like below:

Network Dev 

```bash
cdk synth -q && cdk diff -a cdk.out/assembly-TestNetwork-Dev
```

Network Production

```bash
cdk synth -q && cdk diff -a cdk.out/assembly-TestNetwork-Production 
```

ECS Dev

```bash
cdk synth -q && cdk diff -a cdk.out/assembly-TestEcs-Dev
```

Take test deployment further on local environment

```bash
cdk synth -q && cdk deploy -a cdk.out/assembly-TestEcs-Dev –no-rollback

```

> The `–no-rollback` parameter is useful for test deployment for CloudFormation
