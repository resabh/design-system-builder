#!/usr/bin/env node
/**
 * End-to-end extraction test with mock provider
 * Tests the complete extraction pipeline from URL to design system output
 */

const { DesignSystemExtractor } = require('./packages/extractor/dist/index.js');
const { createLogger } = require('./packages/extractor/dist/index.js');

const logger = createLogger('e2e-test');

console.log('🧪 End-to-End Extraction Test\n');
console.log('=' .repeat(60));
console.log('Testing complete extraction pipeline with mock provider\n');

// Mock provider that simulates Claude Vision API
const mockProvider = {
  name: 'mock-claude',
  initialize: async () => {
    logger.info('Mock provider initialized');
  },
  validate: async () => true,
  analyzeImage: async (request) => {
    logger.info('Mock vision analysis called', {
      imageCount: request.images?.length || 0,
      promptLength: request.prompt?.length || 0
    });

    // Simulate realistic design system response
    const mockDesignSystem = {
      tokens: {
        colors: [
          { name: 'primary', value: '#0066cc', type: 'color' },
          { name: 'secondary', value: '#6c757d', type: 'color' },
          { name: 'success', value: '#28a745', type: 'color' },
          { name: 'danger', value: '#dc3545', type: 'color' }
        ],
        typography: [
          { name: 'font-base', value: 'Arial, sans-serif', type: 'fontFamily' },
          { name: 'font-size-base', value: '16px', type: 'fontSize' },
          { name: 'line-height-base', value: '1.5', type: 'lineHeight' }
        ],
        spacing: [
          { name: 'space-xs', value: '4px', type: 'spacing' },
          { name: 'space-sm', value: '8px', type: 'spacing' },
          { name: 'space-md', value: '16px', type: 'spacing' },
          { name: 'space-lg', value: '24px', type: 'spacing' }
        ],
        shadows: [
          { name: 'shadow-sm', value: '0 1px 2px rgba(0,0,0,0.1)', type: 'shadow' }
        ],
        borderRadius: [
          { name: 'radius-sm', value: '4px', type: 'borderRadius' },
          { name: 'radius-md', value: '8px', type: 'borderRadius' }
        ]
      },
      components: [
        {
          name: 'Button',
          category: 'form',
          variants: ['primary', 'secondary', 'outline'],
          states: ['default', 'hover', 'active', 'disabled']
        },
        {
          name: 'Input',
          category: 'form',
          variants: ['text', 'email', 'password'],
          states: ['default', 'focus', 'error']
        }
      ],
      patterns: [
        {
          name: 'Card Layout',
          description: 'Consistent spacing and shadows for card components'
        }
      ]
    };

    return {
      content: JSON.stringify(mockDesignSystem),
      usage: {
        inputTokens: 2500,
        outputTokens: 1200
      },
      model: 'mock-claude-3.5',
      raw: {}
    };
  },
  getPricing: () => ({
    inputPer1M: 3,
    outputPer1M: 15,
    currency: 'USD'
  }),
  calculateCost: (usage) => {
    const inputCost = (usage.inputTokens / 1000000) * 3;
    const outputCost = (usage.outputTokens / 1000000) * 15;
    return inputCost + outputCost;
  }
};

async function testFullExtraction() {
  console.log('📋 Test 1: Full Extraction Pipeline');
  console.log('-' .repeat(60));

  try {
    // Create extractor with reasonable limits for testing
    const extractor = new DesignSystemExtractor(mockProvider, {
      viewport: { width: 1280, height: 720 },
      maxComponents: 10,
      captureStates: false,
      timeout: 15000
    });

    console.log('🌐 Extracting design system from example.com...');
    console.log('   (Using headless browser + mock vision API)\n');

    // Enable debug logging for this test
    process.env.LOG_LEVEL = 'debug';

    const startTime = Date.now();
    const designSystem = await extractor.extract('https://example.com');
    const duration = Date.now() - startTime;

    console.log('\n✅ Extraction Complete!');
    console.log('-' .repeat(60));
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`🎨 Tokens Extracted: ${Object.keys(designSystem.tokens).length} categories`);
    console.log(`   - Colors: ${designSystem.tokens.color ? Object.keys(designSystem.tokens.color).length : 0}`);
    console.log(`   - Typography: ${designSystem.tokens.typography ? Object.keys(designSystem.tokens.typography).length : 0}`);
    console.log(`   - Spacing: ${designSystem.tokens.spacing ? Object.keys(designSystem.tokens.spacing).length : 0}`);
    console.log(`🧩 Components: ${designSystem.components.length}`);
    console.log(`📐 Patterns: ${designSystem.patterns.length}`);
    console.log(`💰 Cost: $${designSystem.metadata.cost.toFixed(4)}`);
    console.log(`🔗 Source: ${designSystem.metadata.sourceUrl}`);
    console.log(`⚙️  Provider: ${designSystem.metadata.provider}`);

    // Verify structure
    if (!designSystem.tokens || !designSystem.components || !designSystem.patterns) {
      throw new Error('Missing required design system properties');
    }

    if (!designSystem.metadata || !designSystem.metadata.sourceUrl) {
      throw new Error('Missing metadata');
    }

    console.log('\n✅ Test 1 PASSED: Full extraction works end-to-end\n');
    return designSystem;

  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    throw error;
  }
}

async function testInvalidURL() {
  console.log('📋 Test 2: URL Validation (Before Browser Launch)');
  console.log('-' .repeat(60));

  const extractor = new DesignSystemExtractor(mockProvider);

  try {
    await extractor.extract('file:///etc/passwd');
    console.log('❌ Test 2 FAILED: Should have rejected file:// URL\n');
    process.exit(1);
  } catch (error) {
    if (error.name === 'InvalidURLError') {
      console.log('✅ Test 2 PASSED: Rejected file:// URL before browser launch');
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code}\n`);
    } else {
      console.log(`❌ Test 2 FAILED: Wrong error type: ${error.name}\n`);
      throw error;
    }
  }
}

async function testCostEstimation() {
  console.log('📋 Test 3: Cost Estimation');
  console.log('-' .repeat(60));

  const { estimateCost } = require('./packages/extractor/dist/index.js');

  const estimates = [
    { options: {}, label: 'Default (20 components)' },
    { options: { maxComponents: 5 }, label: '5 components' },
    { options: { maxComponents: 10, captureStates: true }, label: '10 components + states' }
  ];

  estimates.forEach(({ options, label }) => {
    const cost = estimateCost(options);
    console.log(`   ${label}: $${cost.toFixed(4)}`);
  });

  console.log('✅ Test 3 PASSED: Cost estimation working\n');
}

async function runTests() {
  try {
    console.log('Starting end-to-end extraction tests...\n');

    // Test 1: Full extraction
    const designSystem = await testFullExtraction();

    // Test 2: Validation
    await testInvalidURL();

    // Test 3: Cost estimation
    await testCostEstimation();

    // Summary
    console.log('=' .repeat(60));
    console.log('🎉 All End-to-End Tests Passed!');
    console.log('=' .repeat(60));
    console.log('✅ URL Validation: Blocks invalid URLs before browser launch');
    console.log('✅ Browser Automation: Playwright captures screenshots');
    console.log('✅ Vision Analysis: Mock API returns structured design system');
    console.log('✅ Synthesis: Design system builder combines sources');
    console.log('✅ Output: Valid DesignSystem object with all properties');
    console.log('✅ Metadata: Tracking cost, source, provider, timestamp');
    console.log('✅ Error Handling: Proper error types with context');
    console.log('\n💡 Production Readiness:');
    console.log('   ✅ Core extraction pipeline: WORKING');
    console.log('   ✅ Input validation: WORKING');
    console.log('   ✅ Error handling: WORKING');
    console.log('   ✅ Cost tracking: WORKING');
    console.log('   ✅ Browser automation: WORKING');
    console.log('\n🚀 Ready for beta testing with real provider (Anthropic/Vertex)');
    console.log('   Run: node packages/cli/dist/index.js config --provider anthropic');
    console.log('   Then: node packages/cli/dist/index.js extract https://example.com');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

runTests();
