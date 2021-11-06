import * as fs from 'fs';
import { App } from '@aws-cdk/core';
import { readConfig } from './utils';


export interface GlobalConfig {
  cdkVersion: string;
  account: {
    dev: string;
    staging: string;
    prod: string;
  };
}

const app = new App();

const globalConfig: GlobalConfig = readConfig(
  fs.readFileSync(`${__dirname}/../config.yml`, 'utf8'),
) as GlobalConfig;

new NetworkCdkPipelines(app, 'WonderciseNetwork', {
  env: {
    account: '001247437748',
    region: 'ap-northeast-1',
  },
  cdkVersion: globalConfig.cdkVersion,
  devAccount: globalConfig.account.dev,
  stagingAccount: globalConfig.account.staging,
  prodAccount: globalConfig.account.prod,
});

app.synth();