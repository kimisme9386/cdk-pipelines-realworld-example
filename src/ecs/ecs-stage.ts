import * as fs from 'fs';
import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { readConfig } from '../utils';
import { EcsFargateStack, StageConfig } from './ecs-stack';

export enum DeploymentType {
  RollingUpdate = 'RollingUpdate',
  BlueGreen = 'BlueGreen',
}

enum StageEnv {
  DEV = 'dev',
  PROD = 'prod',
}

interface EcsApiStageProps extends StageProps {
  stageEnv: string;
}


/**
 * Deployable unit of web service app
 */
export class EcsStage extends Stage {
  private readonly _ecsStack: EcsFargateStack;

  constructor(scope: Construct, id: string, props?: EcsApiStageProps) {
    super(scope, id, props);

    const stageEnv = props?.stageEnv;

    if (stageEnv === undefined || !Object.values(StageEnv).includes(stageEnv as StageEnv)) {
      throw new Error('stageEnv is required');
    }

    const stageConfig: StageConfig = readConfig(
      fs.readFileSync(`${__dirname}/configs/${stageEnv}.yml`, 'utf8'),
    ) as StageConfig;

    this._ecsStack = new EcsFargateStack(this, 'Ecs', {
      stageConfig,
      env: props?.env,
    });
  }

  public get ecsStack() {
    return this._ecsStack;
  }
}
