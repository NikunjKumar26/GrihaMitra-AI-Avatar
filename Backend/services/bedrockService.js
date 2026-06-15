const { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const AIUsageMetrics = require('../models/AIUsageMetrics');

const hasCredentials = process.env.AWS_ACCESS_KEY_ID && 
                       process.env.AWS_SECRET_ACCESS_KEY && 
                       process.env.AWS_REGION;

let clientInstance = null;

/**
 * Get or initialize Bedrock client singleton
 */
function getBedrockClient() {
  if (!hasCredentials) {
    throw new Error('CRITICAL: AWS credentials missing in environment. Bedrock execution disabled.');
  }
  
  if (!clientInstance) {
    clientInstance = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return clientInstance;
}

/**
 * Estimate AWS Bedrock Cost in USD based on input/output tokens and model ID
 */
function estimateCost(modelId, inputTokens, outputTokens) {
  const model = modelId.toLowerCase();
  let inputRate = 0.000003; // Sonnet default: $0.003 / 1000 ($3.00 per 1M tokens)
  let outputRate = 0.000015; // Sonnet default: $0.015 / 1000 ($15.00 per 1M tokens)

  if (model.includes('haiku')) {
    inputRate = 0.00000025; // Haiku: $0.00025 / 1000
    outputRate = 0.00000125; // Haiku: $0.00125 / 1000
  } else if (model.includes('opus')) {
    inputRate = 0.000015; // Opus: $0.015 / 1000
    outputRate = 0.000075; // Opus: $0.075 / 1000
  } else if (model.includes('nova-lite') || model.includes('nova.lite')) {
    inputRate = 0.00000006; // Nova Lite: $0.06 per 1M tokens ($0.00006 per 1k)
    outputRate = 0.00000024; // Nova Lite: $0.24 per 1M tokens ($0.00024 per 1k)
  } else if (model.includes('nova-pro') || model.includes('nova.pro')) {
    inputRate = 0.0000008; // Nova Pro: $0.80 per 1M tokens ($0.0008 per 1k)
    outputRate = 0.0000032; // Nova Pro: $3.20 per 1M tokens ($0.0032 per 1k)
  } else if (model.includes('nova-micro') || model.includes('nova.micro')) {
    inputRate = 0.000000035; // Nova Micro: $0.035 per 1M tokens
    outputRate = 0.00000014; // Nova Micro: $0.14 per 1M tokens
  }

  return (inputTokens * inputRate) + (outputTokens * outputRate);
}

/**
 * Invoke Bedrock model with retry, timeout protection, and telemetry tracking
 */
exports.invokeModel = async (prompt, maxTokens = 512, temperature = 0.7) => {
  const bedrock = getBedrockClient();
  const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';
  
  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    const controller = new AbortController();
    // 15 seconds timeout per attempt
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      let textResponse = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (modelId.toLowerCase().includes('nova')) {
        // Amazon Nova Models: Bedrock Converse API format
        const command = new ConverseCommand({
          modelId: modelId,
          messages: [
            {
              role: 'user',
              content: [{ text: prompt }]
            }
          ],
          inferenceConfig: {
            maxTokens: maxTokens,
            temperature: temperature,
            topP: 0.9
          }
        });

        const response = await bedrock.send(command, { abortSignal: controller.signal });
        clearTimeout(timeoutId);

        textResponse = response.output.message.content[0].text.trim();
        inputTokens = response.usage?.inputTokens || 0;
        outputTokens = response.usage?.outputTokens || 0;
      } else {
        // Anthropic Claude / Legacy Model format: InvokeModelCommand API format
        const payload = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: maxTokens,
          temperature: temperature,
          messages: [
            { role: 'user', content: [{ type: 'text', text: prompt }] }
          ]
        };

        const command = new InvokeModelCommand({
          modelId: modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(payload)
        });

        const response = await bedrock.send(command, { abortSignal: controller.signal });
        clearTimeout(timeoutId);

        const resBody = JSON.parse(new TextDecoder().decode(response.body));
        textResponse = resBody.content[0].text.trim();
        inputTokens = resBody.usage?.input_tokens || 0;
        outputTokens = resBody.usage?.output_tokens || 0;
      }

      const latency = Date.now() - startTime;
      const cost = estimateCost(modelId, inputTokens, outputTokens);

      // Save usage metrics asynchronously
      AIUsageMetrics.create({
        serviceType: 'Bedrock',
        modelId,
        inputTokens,
        outputTokens,
        latencyMs: latency,
        costEstimation: cost
      }).catch(err => console.error('[Telemetry] Metrics write failed:', err.message));

      return textResponse;

    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Bedrock Retry Warning] Attempt ${attempts} failed: ${err.message}`);
      
      const isRetryable = err.name === 'ThrottlingException' || err.name === 'AbortError' || err.message.includes('timeout');
      
      if (attempts >= maxAttempts || !isRetryable) {
        const latency = Date.now() - startTime;
        
        // Log failure metrics
        AIUsageMetrics.create({
          serviceType: 'Bedrock',
          modelId,
          latencyMs: latency,
          isError: true,
          errorMessage: err.message
        }).catch(teleErr => console.error('[Telemetry] Fail metrics write failed:', teleErr.message));

        throw err;
      }

      // Backoff delay before retry (1s, 2s)
      await new Promise(resolve => setTimeout(resolve, attempts * 1000));
    }
  }
};

/**
 * Unified generateAIResponse abstraction supporting automatic model routing
 */
exports.generateAIResponse = async (prompt) => {
  return await exports.invokeModel(prompt);
};
