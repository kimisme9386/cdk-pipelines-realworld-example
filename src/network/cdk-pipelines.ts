import * as codebuild from '@aws-cdk/aws-codebuild';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import * as pipelines from '@aws-cdk/pipelines';
import { NetworkStage } from './network-stage';

interface CdkPipelinesProps extends StackProps {
  cdkVersion: string;
  devAccount: string;
  prodAccount: string;
}

/**
 * The stack that defines the application pipeline
 */
export class CdkPipelines extends Stack {
  constructor(scope: Construct, id: string, props: CdkPipelinesProps) {
    super(scope, id, props);

    const codePipelineSource = pipelines.CodePipelineSource.connection(
      'kimisme9386/cdk-pipelines-realworld-example',
      'main',
      {
        connectionArn:
          'arn:aws:codestar-connections:ap-northeast-1:794029059620:connection/2f474bca-8f43-41e6-b3ad-b36f3e4c5d4d',
      },
    );

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      // The pipeline name
      pipelineName: 'NetworkPipelines',

      // How it will be built and synthesized
      synth: new pipelines.ShellStep('Synth', {
        // Where the source can be found
        input: codePipelineSource,

        // Install dependencies, build and run cdk synth
        commands: [
          `npm install -g aws-cdk@${props.cdkVersion}`,
          'yarn install --frozen-lockfile',
          'npx projen',
          'cdk synth',
        ],
      }),
      crossAccountKeys: true,
      selfMutationCodeBuildDefaults: {
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          phases: {
            pre_build: {
              commands: [
                `npm install -g aws-cdk@${props.cdkVersion}`,
              ],
            },
          },
        }),
      },
    });

    const envWave = pipeline.addWave('Network');

    envWave.addStage(
      new NetworkStage(this, 'Dev', {
        env: { account: props.devAccount, region: 'ap-northeast-1' },
        stageEnv: 'dev',
      }),
      {
        pre: [new pipelines.ShellStep('Validate dev CloudFormation Synth', {
          commands: [
            'yarn install --frozen-lockfile',
            './node_modules/.bin/jest --passWithNoTests test/network-dev.test.ts',
          ],
        })],
      },
    );

    envWave.addStage(
      new NetworkStage(this, 'Production', {
        env: { account: props.prodAccount, region: 'ap-northeast-1' },
        stageEnv: 'prod',
      }),
      {
        pre: [new pipelines.ShellStep('Validate staging CloudFormation Synth', {
          commands: [
            'yarn install --frozen-lockfile',
            './node_modules/.bin/jest --passWithNoTests test/network-prod.test.ts',
          ],
        })],
      },
    );
  }
}
