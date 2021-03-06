import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';

export enum DeploymentType {
  RollingUpdate = 'RollingUpdate',
  BlueGreen = 'BlueGreen',
}

interface NetworkConfig {
  vpc: string;
  alb: {
    arn: string;
    listener: {
      certificateArn: string;
    };
    targetHealthCheck: {
      enabled: boolean;
      interval: number;
      path: string;
      timeout: number;
      healthyThresholdCount: number;
      unhealthyThresholdCount: number;
    };
    deregistrationDelay: number;
  };
};

export interface StageConfig {
  Ecs: {
    memoryLimitMiB: number;
    cpu: number;
    family: string;
    executionRoleArn: string;
    taskRole: {
      customManagedPolicies: string[];
    };
    container: {
      name: string;
      environment: {
        [key: string]: string;
      };
    };
    service: {
      desiredCount: number;
      minHealthyPercent: number;
      maxHealthyPercent: number;
      circuitBreakerRollback: boolean;
      assignPublicIp: boolean;
    };
  };
  Deployment: {
    type: string;
  };
  Network: NetworkConfig;
}


interface EcsFargateProps extends cdk.StackProps {
  stageConfig: StageConfig;
}

export class EcsFargateStack extends cdk.Stack {
  readonly service: ecs.FargateService;
  readonly taskDefinition: ecs.FargateTaskDefinition;
  readonly ecrRepository: ecr.Repository;
  readonly prodTrafficListener: elbv2.ApplicationListener | null = null;
  readonly prodTargetGroup: elbv2.ApplicationTargetGroup | null = null;
  readonly testTrafficListener: elbv2.ApplicationListener | null = null;
  readonly testTargetGroup: elbv2.ApplicationTargetGroup | null = null;

  constructor(scope: cdk.Construct, id: string, props: EcsFargateProps) {
    super(scope, id, props);

    this.ecrRepository = new ecr.Repository(this, 'Repository', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc =
      props.stageConfig.Network.vpc ?
        ec2.Vpc.fromLookup(this, 'fromVpc', { vpcId: props.stageConfig.Network.vpc }) :
        ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: vpc,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: props.stageConfig.Ecs.memoryLimitMiB,
      cpu: props.stageConfig.Ecs.cpu,
      family: props.stageConfig.Ecs.family,
    });

    this.taskDefinition.addContainer(props.stageConfig.Ecs.container.name, {
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository),
      environment: props.stageConfig.Ecs.container.environment,
      portMappings: [{ containerPort: 80, hostPort: 80 }],
      logging: ecs.LogDriver.awsLogs({
        logGroup: new logs.LogGroup(this, 'EcsLogGroup'),
        streamPrefix: 'ecs',
      }),
    });

    let ecsServiceProperty = {};
    if (props.stageConfig.Deployment.type == DeploymentType.RollingUpdate) {
      ecsServiceProperty = {
        circuitBreaker: {
          rollback: props.stageConfig.Ecs.service.circuitBreakerRollback,
        },
      };
    } else if (props.stageConfig.Deployment.type == DeploymentType.BlueGreen) {
      ecsServiceProperty = {
        deploymentController: {
          // The property has a bug because type value is always ECS.
          type: ecs.DeploymentControllerType.CODE_DEPLOY,
        },
      };
    }

    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: props.stageConfig.Ecs.service.desiredCount,
      minHealthyPercent: props.stageConfig.Ecs.service.minHealthyPercent,
      maxHealthyPercent: props.stageConfig.Ecs.service.maxHealthyPercent,
      healthCheckGracePeriod: cdk.Duration.seconds(0),
      assignPublicIp: props.stageConfig.Ecs.service.assignPublicIp,
      vpcSubnets: vpc.selectSubnets({
        subnetType:
          props.stageConfig.Ecs.service.assignPublicIp == true
            ? ec2.SubnetType.PUBLIC
            : ec2.SubnetType.PRIVATE_WITH_NAT,
      }),
      ...ecsServiceProperty,
    });

    if (props.stageConfig.Deployment.type == DeploymentType.BlueGreen) {
      // workaround
      const cfnECSService = this.service.node.defaultChild as ecs.CfnService;
      cfnECSService.addPropertyOverride('DeploymentController', 'CODE_DEPLOY');
    }

    if (props) {
      const fromALB = elbv2.ApplicationLoadBalancer.fromLookup(this, 'fromALB', {
        loadBalancerArn: props.stageConfig.Network.alb.arn,
      });
      let alb = this.createAlbListenerAndTargetGroup(
        'Prod',
        fromALB,
        this.service,
        props.stageConfig.Network,
        443,
        80,
      );

      this.prodTrafficListener = alb.listener;
      this.prodTargetGroup = alb.targetGroup;

      if (props.stageConfig.Deployment.type == DeploymentType.BlueGreen) {
        let testAlb =
          this.createAlbListenerAndTargetGroup(
            'Test',
            fromALB,
            this.service,
            props.stageConfig.Network,
            8080,
            80,
          );

        this.testTrafficListener = testAlb.listener;
        this.testTargetGroup = testAlb.targetGroup;
      }
    }
  }

  private createAlbListenerAndTargetGroup(
    prefixName: string,
    alb: elbv2.IApplicationLoadBalancer,
    service: ecs.FargateService,
    networkProps: NetworkConfig,
    loadBalancerPort: number,
    targetGroupPort: number,
  ): {
      listener: elbv2.ApplicationListener;
      targetGroup: elbv2.ApplicationTargetGroup;
    } {
    const sslPolicy =
      prefixName == 'Prod'
        ? {
          sslPolicy: elbv2.SslPolicy.RECOMMENDED,
        }
        : '';

    const listener = new elbv2.ApplicationListener(
      this,
      `Alb${prefixName}Listener`,
      {
        loadBalancer: alb,
        port: loadBalancerPort,
        ...sslPolicy,
      },
    );

    if (prefixName == 'Prod' && networkProps.alb?.listener?.certificateArn) {
      listener.addCertificates(`Alb${prefixName}ListenerCertification`, [
        {
          certificateArn: networkProps.alb.listener.certificateArn,
        },
      ]);
    }

    new elbv2.ApplicationListenerRule(this, `Alb${prefixName}ListenerRule`, {
      listener: listener,
      priority: 10,
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'application/json',
        messageBody: '',
      }),
      conditions: [elbv2.ListenerCondition.pathPatterns(['/status'])],
    });

    const targetGroup = listener.addTargets(`ECSFor${prefixName}`, {
      port: targetGroupPort,
      targets: [service],
      healthCheck: {
        enabled: networkProps.alb.targetHealthCheck.enabled,
        interval: cdk.Duration.seconds(
          networkProps.alb.targetHealthCheck.interval,
        ),
        path: networkProps.alb.targetHealthCheck.path,
        timeout: cdk.Duration.seconds(
          networkProps.alb.targetHealthCheck.timeout,
        ),
        healthyThresholdCount:
          networkProps.alb.targetHealthCheck.healthyThresholdCount,
        unhealthyThresholdCount:
          networkProps.alb.targetHealthCheck.unhealthyThresholdCount,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(
        networkProps.alb.deregistrationDelay,
      ),
    });

    return { listener, targetGroup };
  }
}