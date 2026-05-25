import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

// gemini
const GEMINI_MODEL = 'google/gemini-2.5-flash';

// Amazon Bedrock
const amazonBedrock = createAmazonBedrock({
  region: 'ap-northeast-1',
  credentialProvider: fromNodeProviderChain(),
});

const BEDROCK_MODEL = amazonBedrock('jp.anthropic.claude-haiku-4-5-20251001-v1:0');

export {
  BEDROCK_MODEL, GEMINI_MODEL
};

