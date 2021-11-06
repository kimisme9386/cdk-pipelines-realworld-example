import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import { Construct, Stack, StackProps, Fn } from '@aws-cdk/core';
import * as cdk from '@aws-cdk/core';

export interface StageConfig {
  vpc: {
    maxAzs: number;
    natGateways: number;
    ipv6enabled: boolean;
  };
}


interface NetworkStackProps extends StackProps {
  stageConfig: StageConfig;
}

export class NetworkStack extends Stack {
  vpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;


  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const subnetConfiguration = [
      {
        cidrMask: 24,
        name: 'ingress',
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: 28,
        name: 'rds',
        subnetType: ec2.SubnetType.ISOLATED,
      },
    ];

    if (props.stageConfig.vpc.natGateways != 0) {
      subnetConfiguration.push({
        cidrMask: 24,
        name: 'application',
        subnetType: ec2.SubnetType.PRIVATE,
      });
    }

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: props.stageConfig.vpc.maxAzs,
      natGateways: props.stageConfig.vpc.natGateways,
      subnetConfiguration: subnetConfiguration,
    });

    if (props.stageConfig.vpc.ipv6enabled) this.enableIpv6(this.vpc);

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: this.vpc,
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.DUAL_STACK,
      vpcSubnets: this.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
    });
  }

  enableIpv6(vpc: ec2.Vpc) {
    const cfnIpv6Cidr = new ec2.CfnVPCCidrBlock(this, 'Ipv6Cidr', {
      vpcId: vpc.vpcId,
      amazonProvidedIpv6CidrBlock: true,
    });

    this.vpc.publicSubnets.forEach((subnet, idx) => {
      const vpcCidrBlock = cdk.Fn.select(0, this.vpc.vpcIpv6CidrBlocks);
      const ipv6Cidrs = cdk.Fn.cidr(
        vpcCidrBlock,
        this.vpc.publicSubnets.length,
        '64',
      );
      const cfnSubnet = subnet.node.defaultChild as ec2.CfnSubnet;
      cfnSubnet.ipv6CidrBlock = cdk.Fn.select(idx, ipv6Cidrs);
      cfnSubnet.addDependsOn(cfnIpv6Cidr);
    });

    cfnIpv6Cidr.addDependsOn(this.vpc.node.defaultChild as ec2.CfnVPC);
  }
}