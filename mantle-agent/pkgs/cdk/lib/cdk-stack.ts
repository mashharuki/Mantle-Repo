import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// 必須パラメータ（未設定の場合はデプロイエラー）
const REQUIRED_KEYS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "LIBSQL_URL",
  "LIBSQL_AUTH_TOKEN",
] as const;

// 任意パラメータ（未設定の場合は SSM 登録・Lambda 環境変数へのセットをスキップ）
const OPTIONAL_KEYS = [
  "TENDERLY_ACCESS_KEY",
  "TENDERLY_ACCOUNT",
  "TENDERLY_PROJECT",
] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];
type OptionalKey = (typeof OPTIONAL_KEYS)[number];

/**
 * CDK スタック
 */
export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── .env を読み込む ──
    const envPath = path.join(__dirname, "../../frontend/.env");
    let envVars: Record<string, string> = {};

    if (fs.existsSync(envPath)) {
      envVars = dotenv.parse(fs.readFileSync(envPath)) as Record<string, string>;
    } else {
      console.warn(
        `[CDK] WARNING: ${envPath} が見つかりません。pkgs/frontend/.env を作成してください。`
      );
    }

    // ── 必須パラメータの SSM 登録 ──
    const requiredParams: Record<RequiredKey, ssm.StringParameter> = {} as Record<
      RequiredKey,
      ssm.StringParameter
    >;

    for (const key of REQUIRED_KEYS) {
      const value = envVars[key];
      if (!value) {
        console.warn(`[CDK] WARNING: .env に ${key} が定義されていません。`);
      }
      requiredParams[key] = new ssm.StringParameter(this, `Param${key}`, {
        parameterName: `/mantle-agent/${key}`,
        stringValue: value ?? "PLACEHOLDER",
        description: `mantle-agent ${key}`,
      });
    }

    // ── 任意パラメータの SSM 登録（値がある場合のみ） ──
    const optionalParams: Partial<Record<OptionalKey, ssm.StringParameter>> = {};

    for (const key of OPTIONAL_KEYS) {
      const value = envVars[key];
      if (value) {
        optionalParams[key] = new ssm.StringParameter(this, `Param${key}`, {
          parameterName: `/mantle-agent/${key}`,
          stringValue: value,
          description: `mantle-agent ${key}`,
        });
      }
    }

    // ── Lambda 環境変数の組み立て ──
    const lambdaEnv: Record<string, string> = {
      GOOGLE_GENERATIVE_AI_API_KEY: requiredParams["GOOGLE_GENERATIVE_AI_API_KEY"].stringValue,
      LIBSQL_URL: requiredParams["LIBSQL_URL"].stringValue,
      LIBSQL_AUTH_TOKEN: requiredParams["LIBSQL_AUTH_TOKEN"].stringValue,
      MANTLE_RPC_MAINNET: "https://rpc.mantle.xyz",
      MANTLE_RPC_TESTNET: "https://rpc.sepolia.mantle.xyz",
    };

    // 任意パラメータは SSM に登録されている場合のみ追加
    for (const key of OPTIONAL_KEYS) {
      const param = optionalParams[key];
      if (param) {
        lambdaEnv[key] = param.stringValue;
      }
    }

    // ── 各種パス ──
    const monoRepoRoot = path.join(__dirname, "../../../");
    const frontendDir = path.join(__dirname, "../../frontend");

    // ── CloudWatch Logs グループ ──
    const logGroup = new logs.LogGroup(this, "NextjsFunctionLogGroup", {
      logGroupName: "/aws/lambda/mantle-agent",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Lambda Function（Docker イメージ） ──
    const fn = new lambda.DockerImageFunction(this, "NextjsFunction", {
      functionName: "mantle-agent",
      code: lambda.DockerImageCode.fromImageAsset(monoRepoRoot, {
        file: "Dockerfile",
      }),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(120),
      logGroup,
      environment: lambdaEnv,
    });

    // SSM パラメータが Lambda より先に作成されるよう依存関係を追加
    for (const param of Object.values(requiredParams)) {
      fn.node.addDependency(param);
    }
    for (const param of Object.values(optionalParams)) {
      if (param) fn.node.addDependency(param);
    }

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
      sources: [s3deploy.Source.asset(path.join(frontendDir, ".next/static"))],
      destinationBucket: staticBucket,
      destinationKeyPrefix: "_next/static",
      distribution,
      distributionPaths: ["/_next/static/*"],
    });

    // ── Outputs ──
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
