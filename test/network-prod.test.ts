import '@aws-cdk/assert/jest';
import * as fs from 'fs';
import { SynthUtils } from '@aws-cdk/assert';
import { App } from '@aws-cdk/core';
import { GlobalConfig } from '../src/main';
import { NetworkStage } from '../src/network/network-stage';
import { readConfig } from '../src/utils';

test('EcsApiStage Snapshot', () => {
  const app = new App();

  const globalConfig: GlobalConfig = readConfig(
    fs.readFileSync(`${__dirname}/../configs/network.yml`, 'utf8'),
  ) as GlobalConfig;

  const networkStage = new NetworkStage(app, 'prod', {
    env: { account: globalConfig.account.dev, region: 'ap-northeast-1' },
    stageEnv: 'prod',
  });

  expect(SynthUtils.toCloudFormation(networkStage.networkStack)).toMatchSnapshot();
});