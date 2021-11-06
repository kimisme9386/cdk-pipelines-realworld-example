import * as fs from 'fs';
import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { readConfig } from '../utils';
import { NetworkStack, StageConfig } from './network-stack';

enum StageEnv {
  DEV = 'dev',
  PROD = 'prod',
}

interface NetworkStageProps extends StageProps {
  stageEnv: string;
}

export class NetworkStage extends Stage {
  private _networkStack:NetworkStack;

  constructor(scope: Construct, id: string, props: NetworkStageProps) {
    super(scope, id, props);

    const stageEnv = props?.stageEnv;

    if (stageEnv === undefined || !Object.values(StageEnv).includes(stageEnv as StageEnv)) {
      throw new Error('stageEnv is required');
    }

    const stageConfig: StageConfig = readConfig(
      fs.readFileSync(`${__dirname}/configs/${stageEnv}.yml`, 'utf8'),
    ) as StageConfig;

    this._networkStack = new NetworkStack(this, 'Network', {
      stageConfig,
      env: props?.env,
    });
  }

  public get networkStack() {
    return this._networkStack;
  }
}