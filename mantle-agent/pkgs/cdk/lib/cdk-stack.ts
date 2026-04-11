import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as path from "path";

/**
 * CDK スタック
 */
export class CdkStack extends cdk.Stack {
  /**
   * コンストラクター
   * @param scope 
   * @param id 
   * @param props 
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── SSM パラメータの取得関数 ──
    const getParam = (name: string) =>
      ssm.StringParameter.valueForStringParameter(this, `/mantle-agent/${name}`);

    // pkgs/cdk/lib から pkgs/frontend への相対パス
    const frontendDir = path.join(__dirname, "../../frontend");

    // ── Lambda Function（Docker イメージ） ──
    const fn = new lambda.DockerImageFunction(this, "NextjsFunction", {
      functionName: "mantle-agent",
      code: lambda.DockerImageCode.fromImageAsset(frontendDir),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(120),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        GOOGLE_GENERATIVE_AI_API_KEY: getParam("GOOGLE_GENERATIVE_AI_API_KEY"),
        LIBSQL_URL: getParam("LIBSQL_URL"),
        LIBSQL_AUTH_TOKEN: getParam("LIBSQL_AUTH_TOKEN"),
        TENDERLY_ACCESS_KEY: getParam("TENDERLY_ACCESS_KEY"),
        TENDERLY_ACCOUNT: getParam("TENDERLY_ACCOUNT"),
        TENDERLY_PROJECT: getParam("TENDERLY_PROJECT"),
        MANTLE_RPC_MAINNET: "https://rpc.mantle.xyz",
        MANTLE_RPC_TESTNET: "https://rpc.sepolia.mantle.xyz",
      },
    });

    // ── Lambda Function URL（ストリーミング + CORS） ──
    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["content-type", "authorization"],
        allowedMethods: [lambda.HttpMethod.ALL],
      },
    });

    // ── S3 バケット（静的アセット _next/static/） ──
    const staticBucket = new s3.Bucket(this, "StaticAssetsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── CloudFront Distribution ──
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "mantle-agent",
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(fnUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        "/_next/static/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(staticBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    // ── 静的アセットを S3 にデプロイ ──
    new s3deploy.BucketDeployment(this, "StaticAssetsDeployment", {
      sources: [
        s3deploy.Source.asset(path.join(frontendDir, ".next/static")),
      ],
      destinationBucket: staticBucket,
      destinationKeyPrefix: "_next/static",
      distribution,
      distributionPaths: ["/_next/static/*"],
    });

    // ========================================================================
    // ── Outputs ──
    // ========================================================================

    new cdk.CfnOutput(this, "AppUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "mantle-agent URL",
    });
    
    new cdk.CfnOutput(this, "LambdaFunctionUrl", {
      value: fnUrl.url,
      description: "Lambda Function URL",
    });
  }
}
