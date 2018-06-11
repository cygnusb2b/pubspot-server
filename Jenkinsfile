node {
  def nodeBuilder = docker.image("scomm/node-build:latest")
  nodeBuilder.pull()

  // Test
  try {
    stage('Checkout') {
      checkout scm
    }

    nodeBuilder.inside("-v ${env.WORKSPACE}:/var/www/html -u 0:0 --entrypoint=''") {
      stage('Yarn') {
        sh 'yarn'
      }
    }
  } catch (e) {
    slackSend color: 'bad', message: "Failed testing ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
    throw e
  }

  if (env.BRANCH_NAME == 'master') {

    // Build
    try {
      stage('Build Container') {
        nodeBuilder = docker.build("pubspot-server:v${env.BUILD_NUMBER}", ".")
      }
    } catch (e) {
      slackSend color: 'bad', message: "Failed building ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
      throw e
    }

    // Deploy
    try {
      stage('Deploy Image') {
        docker.withRegistry('https://664537616798.dkr.ecr.us-east-1.amazonaws.com', 'ecr:us-east-1:aws-jenkins-login') {
          nodeBuilder.push("v${env.BUILD_NUMBER}");
        }
      }
      stage('Deploy Upgrade') {
        rancher confirm: true, credentialId: 'rancher', endpoint: 'https://rancher.as3.io/v2-beta', environmentId: '1a18', image: "664537616798.dkr.ecr.us-east-1.amazonaws.com/pubspot-server:v${env.BUILD_NUMBER}", service: 'pubspot/server', environments: '', ports: '', timeout: 300
      }
      stage('Deploy Notify') {
        slackSend color: 'good', message: "Finished deploying ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
      }
    } catch (e) {
      slackSend color: 'bad', message: "Failed deploying ${env.JOB_NAME} #${env.BUILD_NUMBER} (<${env.BUILD_URL}|View>)"
      throw e
    }

  }

}
