import { join } from 'path';

import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { App } from 'aws-cdk-lib';

export class CdkLabStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Creating VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 4,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          mapPublicIpOnLaunch: true,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 27,
          name: 'internal',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      vpcName: 'test-vpc',
    });

    // Security group for API GW VPC endpoint
    const apiGatewayEndpointSg = new ec2.SecurityGroup(this, 'SG', {
      allowAllOutbound: true,
      description: 'Security group for allowing Internal API GW to be reached',
      securityGroupName: 'apigw-vpc-endpoint-sg',
      vpc: vpc,
    });

    apiGatewayEndpointSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow access to API GW endpoint'
    );

    // Create EC2 instance to invoke internal API GW from
    const ec2SshSg = new ec2.SecurityGroup(this, 'SshSg', {
      allowAllOutbound: true,
      description: 'Security group for allowing SSH access',
      securityGroupName: 'ec2-ssh-sg',
      vpc: vpc,
    });

    ec2SshSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access to EC2 instance'
    );

    const myInstance = new ec2.Instance(this, 'myInstance', {
      instanceName: 'ec2-test-to-apigw',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
      keyName: 'ssh-keypair',  // needs to be created before deploying
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      securityGroup: ec2SshSg,
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Create API GW VPC endpoint
    const apiGatewayVpcEndpoint = vpc.addInterfaceEndpoint('api-gateway-endpoint', {
      open: false,
      privateDnsEnabled: true,
      securityGroups: [apiGatewayEndpointSg],
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Create Lambda function
    const functionProps: NodejsFunctionProps = {
      runtime: Runtime.NODEJS_16_X,
    };

    const helloWorldLambda = new NodejsFunction(this, 'hello-world', {
      entry: join(__dirname, 'hello-world.js'),
      ...functionProps,
    });

    const helloWorldIntegration = new apigw.LambdaIntegration(helloWorldLambda);

    // Create API Gateway
    const apiGatewayResourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*'],
        }),
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          conditions: {
            'StringNotEquals': {
              'aws:SourceVpce': apiGatewayVpcEndpoint.vpcEndpointId
            }
          },
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*'],
        }),
      ]
    });

    const apiGateway = new apigw.LambdaRestApi(this, 'ApiGw', {
      handler: helloWorldLambda,
      deploy: true,
      deployOptions: {
        description: 'Production stage',
        stageName: 'production',
      },
      description: 'Internal API Gateway',
      endpointConfiguration: {
        types: [apigw.EndpointType.PRIVATE],
      },
      policy: apiGatewayResourcePolicy,
      proxy: false,
      restApiName: 'internal-apigw'
    });

    const hello = apiGateway.root.addResource('hello');
    hello.addMethod('GET', helloWorldIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'SSH Command', {
      value: `ssh -i ssh-keypair.pem ec2-user@${myInstance.instancePublicIp}`,
      description: 'Public IP for IP instance',
    });

    new cdk.CfnOutput(this, 'Curl Command', {
      value: `curl -i  https://${apiGatewayVpcEndpoint.vpcEndpointDnsEntries[0]} -H 'Host: ${apiGateway.url}'`,
      description: 'Public IP for IP instance',
    });
  }
}

const app = new App();
new CdkLabStack(app, 'CdkLab');
app.synth();