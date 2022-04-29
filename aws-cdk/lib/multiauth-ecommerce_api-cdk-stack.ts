import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class MultiauthEcommerceApiCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    const userPool = new cognito.UserPool(this, 'ecom-apiuserpool', {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email:{
          required: true,
          mutable: true
        }
      }
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool
    })

    const api = new appsync.GraphqlApi(this, 'graphqlAPI', {
      name: 'product-items-api',
      schema: appsync.Schema.fromAsset("graphql/schema.gql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        },
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool
          }
        }]
      }
    })

    // Create the function
const productLambda = new lambda.Function(this, 'AppSyncProductHandler', {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambdas'),
  memorySize: 1024
})

// Set the new Lambda function as a data source for the AppSync API
const lambdaDs = api.addLambdaDataSource('lambdaDatasource', productLambda);

lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "getProductById"
})

lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "listProducts"
})

lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "productsByCategory"
})

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "createProduct"
})

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "deleteProduct"
})

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "updateProduct"
})

const productTable = new dynamodb.Table(this, 'CDKProductTable', {
  partitionKey: {
    name: 'id',
    type: dynamodb.AttributeType.STRING,
  },
})

// Add a global secondary index to enable another data access pattern
productTable.addGlobalSecondaryIndex({
  indexName: "productsByCategory",
  partitionKey: {
    name: "category",
    type: dynamodb.AttributeType.STRING,
  }
})


// Enable the Lambda function to access the DynamoDB table (using IAM)
productTable.grantFullAccess(productLambda)

// Create an environment variable that we will use in the function code
productLambda.addEnvironment('PRODUCT_TABLE', productTable.tableName)


new cdk.CfnOutput(this, "GraphQLAPIURL", {
  value: api.graphqlUrl
})

new cdk.CfnOutput(this, 'AppSyncAPIKey', {
  value: api.apiKey || ''
})

new cdk.CfnOutput(this, 'ProjectRegion', {
  value: this.region
})

new cdk.CfnOutput(this, "UserPoolId", {
  value: userPool.userPoolId
})

new cdk.CfnOutput(this, "UserPoolClientId", {
  value: userPoolClient.userPoolClientId
})  

}
}


