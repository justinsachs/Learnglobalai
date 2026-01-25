/**
 * MedViro Vertical Seed Data
 * Sets up MedViro as the first vertical with full configuration
 * Based on the Technical Due Diligence analysis
 */

import { getDatabase } from '../connection.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

/**
 * MedViro Vertical Configuration
 * Cannabis industry training platform focused on compliance, safety, and operations
 */
export const medviroVerticalConfig = {
  vertical: 'medviro',
  displayName: 'MedViro Training',
  description: 'Cannabis industry compliance, safety, and operations training platform',
  config: {
    // Branding
    branding: {
      primaryColor: '#10B981', // Green for cannabis industry
      secondaryColor: '#1F2937',
      logo: '/assets/medviro-logo.svg',
      companyName: 'MedViro',
      tagline: 'Compliance Made Simple',
    },

    // Module Structure (5 Pillars from analysis)
    pillars: [
      {
        id: 'pillar-1',
        name: 'Pillar 1: Safety & Compliance Fundamentals',
        description: 'Core safety protocols and regulatory compliance',
        order: 1,
        modules: [
          'intro-to-cannabis-compliance',
          'workplace-safety-basics',
          'regulatory-overview',
        ],
      },
      {
        id: 'pillar-2',
        name: 'Pillar 2: Product Knowledge',
        description: 'Understanding cannabis products and their properties',
        order: 2,
        modules: [
          'cannabis-plant-science',
          'product-categories',
          'quality-control-basics',
        ],
      },
      {
        id: 'pillar-3',
        name: 'Pillar 3: Operations & Procedures',
        description: 'Day-to-day operational procedures and best practices',
        order: 3,
        modules: [
          'inventory-management',
          'point-of-sale-operations',
          'customer-service-compliance',
        ],
      },
      {
        id: 'pillar-4',
        name: 'Pillar 4: Security & Risk Management',
        description: 'Security protocols and risk mitigation',
        order: 4,
        modules: [
          'security-fundamentals',
          'cash-handling',
          'emergency-procedures',
        ],
      },
      {
        id: 'pillar-5',
        name: 'Pillar 5: Advanced Topics',
        description: 'Specialized training and certification preparation',
        order: 5,
        modules: [
          'manager-responsibilities',
          'audit-preparation',
          'case-7-simulation', // Interactive simulation module
        ],
      },
    ],

    // Templates for content generation
    templates: {
      outline: `You are creating a training module outline for MedViro, a cannabis industry training platform.

The module should:
- Focus on compliance and safety
- Use clear, professional language
- Include practical examples from cannabis retail/cultivation
- Reference relevant state and local regulations
- Include knowledge checks throughout

Target audience: Cannabis industry workers ranging from entry-level to management.`,

      sourcepack: `You are creating detailed training content for MedViro.

Content guidelines:
- Write in second person ("You will learn...")
- Include real-world scenarios from cannabis operations
- Reference OSHA, state cannabis regulations, and industry best practices
- Use clear headings and subheadings
- Include "Did You Know?" callout boxes for key facts
- End each section with "Key Takeaways"

Compliance focus areas:
- Seed-to-sale tracking
- ID verification procedures
- Inventory reconciliation
- Waste disposal protocols
- Security requirements`,

      qa: `Review this MedViro training content for:
1. Regulatory accuracy - Does it align with cannabis industry regulations?
2. Safety compliance - Are safety procedures correctly described?
3. Clarity - Is the content clear for entry-level workers?
4. Completeness - Does it cover all necessary topics?
5. Engagement - Is the content engaging and practical?

Flag any content that could create compliance risks.`,

      mediaPromptPack: `Create visual assets for MedViro training that:
- Use professional, clean design
- Incorporate green accent colors
- Show diverse cannabis industry workers
- Demonstrate proper procedures visually
- Include compliance checklists and flowcharts
- Maintain a professional, non-promotional tone`,

      heygenScript: `Script style for MedViro training videos:
- Professional but approachable tone
- Clear pronunciation of industry terms
- Emphasis on safety and compliance
- Conversational yet authoritative
- Include pauses for key points
- Duration: 3-5 minutes per topic`,
    },

    // Quality gates for content generation
    qualityGates: {
      minTotalWords: 8000,
      minWordsPerHeading: 400,
      maxBulletRatio: 0.1,
      requireDisclaimers: true,
      requiredKeywords: [
        'compliance',
        'safety',
        'regulations',
        'procedures',
      ],
    },

    // Required disclaimers
    disclaimers: [
      'This training is for educational purposes only and does not constitute legal advice.',
      'Always follow your state and local cannabis regulations, which may differ from this training.',
      'Consult with your compliance officer for facility-specific procedures.',
      'This content is current as of the date published; regulations may change.',
    ],

    // LLM configuration
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4-turbo',
      temperature: 0.6, // Slightly lower for compliance content
      maxTokens: 8000,
    },

    // Connector configurations
    connectors: {
      lms: {
        provider: 'generic',
        baseUrl: 'https://lms.medviro.com',
        accountId: 'medviro-main',
      },
      storage: {
        bucket: 'medviro-training-assets',
        prefix: 'modules/',
      },
      heygen: {
        avatarId: 'professional-presenter',
        voiceId: 'en-US-professional-1',
      },
    },

    // Chat policy for AI assistant
    chatPolicy: {
      allowedTopics: [
        'cannabis compliance',
        'safety procedures',
        'inventory management',
        'customer service',
        'regulatory questions',
        'product knowledge',
        'training content',
      ],
      prohibitedTopics: [
        'legal advice',
        'medical advice',
        'consumption recommendations',
        'specific legal cases',
        'competitor information',
      ],
      disclaimers: [
        'I can provide general guidance based on the training materials, but always verify with your compliance officer.',
        'For legal questions, please consult with a licensed attorney.',
      ],
      escalationKeywords: [
        'lawsuit',
        'violation',
        'investigation',
        'injury',
        'emergency',
        'police',
        'audit failure',
      ],
      systemPromptAddition: `You are a helpful training assistant for MedViro, specializing in cannabis industry compliance and safety training.
You should:
- Answer questions based on the training materials
- Emphasize compliance and safety best practices
- Redirect legal/medical questions appropriately
- Be supportive and encouraging to learners
- Use the learner's profile to personalize responses`,
    },

    // Onboarding quiz configuration (The Gateway)
    onboardingQuiz: {
      title: 'Welcome to MedViro Training',
      description: 'Help us personalize your learning experience',
      questions: [
        {
          id: 'current-role',
          type: 'select',
          question: 'What is your current role?',
          required: true,
          options: [
            { value: 'budtender', label: 'Budtender / Sales Associate' },
            { value: 'cultivation', label: 'Cultivation Technician' },
            { value: 'processing', label: 'Processing / Manufacturing' },
            { value: 'management', label: 'Store / Facility Manager' },
            { value: 'compliance', label: 'Compliance Officer' },
            { value: 'security', label: 'Security Personnel' },
            { value: 'delivery', label: 'Delivery Driver' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'experience',
          type: 'select',
          question: 'How much experience do you have in the cannabis industry?',
          required: true,
          options: [
            { value: 'none', label: 'New to the industry' },
            { value: '1-2years', label: '1-2 years' },
            { value: '3-5years', label: '3-5 years' },
            { value: '5plus', label: '5+ years' },
          ],
        },
        {
          id: 'learning-goal',
          type: 'textarea',
          question: 'What is your primary learning goal?',
          required: true,
          placeholder: 'e.g., Get certified for my new job, refresh my compliance knowledge, prepare for management role...',
        },
        {
          id: 'learning-style',
          type: 'select',
          question: 'How do you prefer to learn?',
          required: true,
          options: [
            { value: 'visual', label: 'Visual - Charts, diagrams, videos' },
            { value: 'text', label: 'Reading - Detailed written content' },
            { value: 'interactive', label: 'Interactive - Quizzes and simulations' },
            { value: 'audio', label: 'Audio - Listening to explanations' },
            { value: 'mixed', label: 'Mixed - A bit of everything' },
          ],
        },
        {
          id: 'time-availability',
          type: 'select',
          question: 'How much time can you dedicate to training each session?',
          required: true,
          options: [
            { value: 'limited', label: '10-15 minutes (quick sessions)' },
            { value: 'moderate', label: '20-30 minutes (standard sessions)' },
            { value: 'flexible', label: '45+ minutes (deep learning)' },
          ],
        },
      ],
    },

    // Simulation configuration (Case 7 style)
    simulations: {
      enabled: true,
      types: [
        {
          id: 'compliance-scenario',
          name: 'Compliance Decision Scenario',
          description: 'Navigate real-world compliance situations',
        },
        {
          id: 'customer-interaction',
          name: 'Customer Interaction Simulation',
          description: 'Practice handling difficult customer situations',
        },
        {
          id: 'emergency-response',
          name: 'Emergency Response Drill',
          description: 'Make decisions during simulated emergencies',
        },
      ],
    },
  },
};

/**
 * Sample simulation module configuration (Case 7 style)
 * This represents an interactive decision-based learning module
 */
export const case7SimulationModule = {
  moduleId: 'medviro-case7-compliance-sim',
  title: 'Case 7: The Compliance Challenge',
  description: 'Navigate a realistic compliance scenario and make critical decisions that affect your facility\'s standing.',
  vertical: 'medviro',
  moduleType: 'simulation' as const,
  pillar: 'Pillar 5: Advanced Topics',
  orderIndex: 15,
  estimatedMinutes: 20,
  learningObjectives: [
    'Apply compliance knowledge to realistic scenarios',
    'Make informed decisions under pressure',
    'Understand consequences of compliance failures',
    'Practice escalation and reporting procedures',
  ],
  simulationConfig: {
    scenarioId: 'case7-compliance-001',
    title: 'The Compliance Challenge',
    description: 'You are a shift manager at GreenLeaf Dispensary. A series of compliance-related situations arise during your shift. Your decisions will determine the outcome.',
    passingScore: 70,
    steps: [
      {
        id: 'step-1',
        prompt: 'A customer presents an ID that looks suspicious - the photo seems slightly off and the hologram appears faded. The customer claims they left their real ID at home. What do you do?',
        options: [
          {
            id: 'a',
            text: 'Accept the ID since they seem honest',
            score: 0,
            feedback: 'Never accept suspicious IDs. This could result in selling to a minor and serious compliance violations. Always err on the side of caution with ID verification.',
          },
          {
            id: 'b',
            text: 'Politely decline and ask them to return with valid ID',
            score: 100,
            feedback: 'Correct! When an ID is suspicious, you must decline the sale. Explain politely that you need valid government-issued ID with clear, unaltered features.',
          },
          {
            id: 'c',
            text: 'Ask your manager to make the decision',
            score: 50,
            feedback: 'While consulting a manager is generally good, you should know the policy: suspicious IDs must be declined. Don\'t pass the responsibility when the correct action is clear.',
          },
          {
            id: 'd',
            text: 'Ask for a second form of ID',
            score: 70,
            feedback: 'Asking for additional ID is reasonable, but if the primary ID is suspicious, you should still decline unless the second ID is completely valid and matches.',
          },
        ],
      },
      {
        id: 'step-2',
        prompt: 'During a routine inventory count, you notice a discrepancy: 5 grams of flower are missing from the system compared to physical count. What is your first step?',
        options: [
          {
            id: 'a',
            text: 'Adjust the inventory in the system to match physical count',
            score: 0,
            feedback: 'Never adjust inventory without proper investigation and documentation. This could be considered tampering with seed-to-sale records.',
          },
          {
            id: 'b',
            text: 'Document the discrepancy and notify the compliance officer immediately',
            score: 100,
            feedback: 'Correct! Any inventory discrepancy must be documented and reported to the compliance officer. They will determine the appropriate investigation and reporting steps.',
          },
          {
            id: 'c',
            text: 'Recount to make sure it\'s not a counting error',
            score: 80,
            feedback: 'Recounting is a reasonable first step, but you should still document the initial discrepancy. If the recount still shows missing product, escalate immediately.',
          },
          {
            id: 'd',
            text: 'Check the camera footage yourself before reporting',
            score: 40,
            feedback: 'While your initiative is good, compliance investigations should be handled by appropriate personnel. Document and report first; let the compliance officer direct the investigation.',
          },
        ],
      },
      {
        id: 'step-3',
        prompt: 'A delivery driver arrives 30 minutes late for a scheduled delivery. When checking the manifest, you notice the transport vehicle license plate doesn\'t match the registered plate in your system. What do you do?',
        options: [
          {
            id: 'a',
            text: 'Accept the delivery since you recognize the driver',
            score: 0,
            feedback: 'Never accept deliveries with documentation mismatches, regardless of familiarity with the driver. Vehicle registration is a critical compliance checkpoint.',
          },
          {
            id: 'b',
            text: 'Refuse the delivery and contact the distributor to verify',
            score: 100,
            feedback: 'Correct! Any discrepancy in transport documentation requires verification. Refuse the delivery until proper documentation can be confirmed.',
          },
          {
            id: 'c',
            text: 'Accept the delivery but make a note about the discrepancy',
            score: 20,
            feedback: 'Documentation notes don\'t fix compliance violations. Accepting non-compliant deliveries exposes your facility to serious regulatory risk.',
          },
          {
            id: 'd',
            text: 'Ask the driver for explanation before deciding',
            score: 60,
            feedback: 'Getting information is good, but the driver\'s explanation doesn\'t change the documentation requirements. You still need official verification from the distributor.',
          },
        ],
      },
      {
        id: 'step-4',
        prompt: 'A regular customer who you know well asks if they can purchase an additional 2 grams, which would put them 1 gram over the daily purchase limit. They explain they\'re hosting a party this weekend. How do you respond?',
        options: [
          {
            id: 'a',
            text: 'Make an exception since they\'re a loyal customer',
            score: 0,
            feedback: 'Purchase limits are legal requirements, not store policies. Exceeding them is a serious violation regardless of customer loyalty.',
          },
          {
            id: 'b',
            text: 'Explain the legal limit and suggest they return tomorrow',
            score: 100,
            feedback: 'Correct! Daily purchase limits are non-negotiable. Politely explain the legal requirement and offer alternatives within the law.',
          },
          {
            id: 'c',
            text: 'Split the purchase between two transactions with different IDs',
            score: 0,
            feedback: 'This is structuring, which is illegal. Using multiple IDs or transactions to circumvent limits is a serious compliance violation.',
          },
          {
            id: 'd',
            text: 'Sell them only up to the limit and apologize',
            score: 90,
            feedback: 'Good choice! You\'re following the rules. Adding a friendly explanation of why limits exist can help the customer understand.',
          },
        ],
      },
      {
        id: 'step-5',
        prompt: 'At closing time, you realize a budtender forgot to log out a waste disposal that occurred earlier. The physical waste log shows it was done correctly. What should you do?',
        options: [
          {
            id: 'a',
            text: 'Log it now with the current timestamp',
            score: 30,
            feedback: 'Logging with an incorrect timestamp creates inaccurate records. While the disposal was done, the documentation timing matters for compliance.',
          },
          {
            id: 'b',
            text: 'Leave it for the morning shift to handle',
            score: 10,
            feedback: 'Documentation delays increase risk and can be flagged in audits. Address compliance issues as soon as they\'re discovered.',
          },
          {
            id: 'c',
            text: 'Document the error with correct timing and file an incident report',
            score: 100,
            feedback: 'Correct! Accurate documentation of the error, including when it actually occurred and when it was discovered, is the compliant approach.',
          },
          {
            id: 'd',
            text: 'Have the budtender come back to log it properly',
            score: 50,
            feedback: 'While having the responsible person document is reasonable, creating a delayed entry without proper error documentation is still problematic.',
          },
        ],
      },
    ],
  },
};

/**
 * Seed function to populate MedViro configuration
 */
export async function seedMedViro(): Promise<void> {
  const db = getDatabase();

  console.log('Seeding MedViro vertical configuration...');

  // Check if vertical already exists
  const existing = await db.query.verticalConfigs.findFirst({
    where: eq(schema.verticalConfigs.vertical, 'medviro'),
  });

  if (existing) {
    console.log('MedViro vertical already exists, updating...');
    await db.update(schema.verticalConfigs)
      .set({
        displayName: medviroVerticalConfig.displayName,
        description: medviroVerticalConfig.description,
        config: medviroVerticalConfig.config,
        updatedAt: new Date(),
      })
      .where(eq(schema.verticalConfigs.id, existing.id));
  } else {
    console.log('Creating MedViro vertical...');
    await db.insert(schema.verticalConfigs).values(medviroVerticalConfig);
  }

  // Seed the Case 7 simulation module
  console.log('Seeding Case 7 simulation module...');

  const existingModule = await db.query.modules.findFirst({
    where: eq(schema.modules.moduleId, case7SimulationModule.moduleId),
  });

  if (existingModule) {
    console.log('Case 7 module already exists, updating...');
    await db.update(schema.modules)
      .set({
        title: case7SimulationModule.title,
        description: case7SimulationModule.description,
        moduleType: case7SimulationModule.moduleType,
        pillar: case7SimulationModule.pillar,
        orderIndex: case7SimulationModule.orderIndex,
        estimatedMinutes: case7SimulationModule.estimatedMinutes,
        learningObjectives: case7SimulationModule.learningObjectives,
        simulationConfig: case7SimulationModule.simulationConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.modules.id, existingModule.id));
  } else {
    console.log('Creating Case 7 module...');
    await db.insert(schema.modules).values({
      moduleId: case7SimulationModule.moduleId,
      title: case7SimulationModule.title,
      description: case7SimulationModule.description,
      vertical: case7SimulationModule.vertical,
      author: 'system',
      status: 'active',
      moduleType: case7SimulationModule.moduleType,
      pillar: case7SimulationModule.pillar,
      orderIndex: case7SimulationModule.orderIndex,
      estimatedMinutes: case7SimulationModule.estimatedMinutes,
      learningObjectives: case7SimulationModule.learningObjectives,
      simulationConfig: case7SimulationModule.simulationConfig,
    });
  }

  console.log('MedViro seed completed!');
}

// Export for CLI usage
export default seedMedViro;
