import * as fs from 'fs';
import { App } from '@aws-cdk/core';
// import { CdkPipelines as EcsCdkPipelines } from './ecs/cdk-pipelines';
import { CdkPipelines as NetworkCdkPipelines } from './network/cdk-pipelines';
import { readConfig } from './utils';


export interface GlobalConfig {
  cdkVersion: string;
  account: {
    dev: string;
    prod: string;
  };
}

const app = new App();

const globalConfig: GlobalConfig = readConfig(
  fs.readFileSync(`${__dirname}/../config.yml`, 'utf8'),
) as GlobalConfig;

new NetworkCdkPipelines(app, 'TestNetwork', {
  env: {
    account: '794029059620',
    region: 'ap-northeast-1',
  },
  cdkVersion: globalConfig.cdkVersion,
  devAccount: globalConfig.account.dev,
  prodAccount: globalConfig.account.prod,
});

// new EcsCdkPipelines(app, 'TestEcs', {
//   env: {
//     account: '794029059620',
//     region: 'ap-northeast-1',
//   },
//   cdkVersion: globalConfig.cdkVersion,
//   devAccount: globalConfig.account.dev,
//   prodAccount: globalConfig.account.prod,
// });

app.synth();