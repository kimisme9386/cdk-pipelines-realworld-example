const fs = require('fs');
const yaml = require('js-yaml');
const {
  AwsCdkTypeScriptApp,
  Gitpod,
  DevEnvironmentDockerImage,
} = require('projen');

const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.130.0',
  cdkVersionPinning: true,
  defaultReleaseBranch: 'main',
  name: 'cdk-pipelines-realworld-example',

  cdkDependencies: [
    '@aws-cdk/pipelines',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-ecr',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-ecs-patterns',
    '@aws-cdk/aws-elasticloadbalancingv2',
    '@aws-cdk/aws-logs',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-codepipeline',
    '@aws-cdk/aws-codebuild',
    '@aws-cdk/aws-codepipeline-actions',
    '@aws-cdk/aws-codedeploy',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/aws-ssm',
  ],
  devDeps: ['@types/js-yaml@^3.12.5'],
  deps: [
    'js-yaml@^3.14.1',
    '@cloudcomponents/cdk-blue-green-container-deployment@^1.40.1',
    'cdk-codepipeline-badge-notification@^0.2.11',
  ],
  releaseWorkflow: false,
  buildWorkflow: false,
  stale: false,
  depsUpgrade: false,
  context: {
    'availability-zones:account=482631629698:region=ap-northeast-1': [
      'ap-northeast-1a',
      'ap-northeast-1c',
      'ap-northeast-1d',
    ],
  },
});

// gitpod
const gitpodPrebuild = project.addTask('gitpod:prebuild', {
  description: 'Prebuild setup for Gitpod',
});
gitpodPrebuild.exec('yarn install --frozen-lockfile --check-files');
gitpodPrebuild.exec('npx projen upgrade');
gitpodPrebuild.exec('npm i -g aws-cdk');

let gitpod = new Gitpod(project, {
  dockerImage: DevEnvironmentDockerImage.fromFile('.gitpod.Dockerfile'),
  prebuilds: {
    addCheck: true,
    addBadge: true,
    addLabel: true,
    branches: true,
    pullRequests: true,
    pullRequestsFromForks: true,
  },
});

gitpod.addCustomTask({
  name: 'install package and check zsh and zsh plugin',
  init: `yarn gitpod:prebuild
sudo chmod +x ./.gitpod/oh-my-zsh.sh && ./.gitpod/oh-my-zsh.sh`,
});

gitpod.addCustomTask({
  name: 'change default shell to zsh and start zsh shell',
  command: 'sudo chsh -s $(which zsh) && zsh',
});

/* spellchecker: disable */
gitpod.addVscodeExtensions(
  'dbaeumer.vscode-eslint',
  'streetsidesoftware.code-spell-checker-spanish',
);

// sync cdk version to config
const configPath = `${__dirname}/config.yml`;
let configData = yaml.safeLoad(
  fs.readFileSync(configPath, 'utf8'),
);

configData.cdkVersion = project.cdkVersion;

fs.writeFileSync(configPath, yaml.dump(configData), 'utf8');

project.synth();