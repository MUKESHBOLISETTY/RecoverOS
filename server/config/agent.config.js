import { prisma } from './database.config.js';
import { cacheService } from './redis.config.js';

import { ToolExecutorFactory } from '../src/infrastructure/agent/executors/tool-executor.factory.js';
import GmailEmailExecutor from '../src/infrastructure/agent/executors/gmail-email.executor.js';
import { RazorpayLinkExecutor } from '../src/infrastructure/agent/executors/razorpay-link.executor.js';
import { WhatsAppMessageExecutor } from '../src/infrastructure/agent/executors/whatsapp-message.executor.js';
import { EscalateRecoveryExecutor } from '../src/infrastructure/agent/executors/escalate-recovery.executor.js';
import { ScheduleRecoveryExecutor } from '../src/infrastructure/agent/executors/schedule-recovery.executor.js';

import ToolExecutionService from '../src/domain/agent/tools/tool-execution.service.js';
import PrismaAgentExecutionRepository from '../src/infrastructure/db/agent/prisma-agent-execution.repository.js';
import ToolAdapter from '../src/infrastructure/langchain-agent/tool-adapter.js';
import AgentNode from '../src/infrastructure/langchain-agent/nodes/agentNode.js';
import PolicyEvaluator from '../src/domain/agent/policy/policy-evaluator.js';
import createAgentGraph from '../src/infrastructure/langchain-agent/agent-graph.js';
import LangchainAgentService from '../src/infrastructure/langchain-agent/langchain-agent.service.js';

import PrismaRecoveryCaseRepository from '../src/infrastructure/db/recovery/prisma-recovery-case.repository.js';
import PrismaRecoveryActionRepository from '../src/infrastructure/db/agent/prisma-recovery-action.repository.js';
import PrismaRecoveryScheduleRepository from '../src/infrastructure/db/schedule/prisma-recovery-schedule.repository.js';
import PrismaOutboxEventRepository from '../src/infrastructure/db/outbox/prisma-outbox-event.repository.js';

import MemoryToolRegistry from '../src/domain/agent/tools/memory-tool.registry.js';
import MemorySkillRegistry from '../src/domain/agent/skills/memory-skill.registry.js';
import DynamicToolResolver from '../src/domain/agent/tools/dynamic-tool.resolver.js';
import SkillLoader from '../src/domain/agent/skills/skill-loader.js';
import PolicyContextBuilder from '../src/domain/agent/policy/policy-context.builder.js';
import ContextAssembler from '../src/domain/agent/execution/context-assembler.js';
import SkillValidator from '../src/domain/agent/skills/skill-validator.js';
import SkillSelector from '../src/domain/agent/skills/skill-selector.js';

const toolExecutorFactory = new ToolExecutorFactory();

import { connectorManager } from './connectors.config.js';

const recoveryCaseRepository = new PrismaRecoveryCaseRepository(prisma);
const recoveryActionRepository = new PrismaRecoveryActionRepository(prisma);
const recoveryScheduleRepository = new PrismaRecoveryScheduleRepository(prisma);
const outboxEventRepository = new PrismaOutboxEventRepository(prisma);

toolExecutorFactory.registerExecutor('communication.email', new GmailEmailExecutor(connectorManager, recoveryActionRepository));

toolExecutorFactory.registerExecutor('communication.whatsapp', new WhatsAppMessageExecutor());

import GoogleSheetsSimulationSink from '../src/infrastructure/google/google-sheets-simulation.sink.js';
import SimulatedSmsProvider from '../src/domain/communication/simulated-sms.provider.js';
import { SmsExecutor } from '../src/infrastructure/agent/executors/sms.executor.js';

const simulationSink = new GoogleSheetsSimulationSink();
const simulatedSmsProvider = new SimulatedSmsProvider(simulationSink);
toolExecutorFactory.registerExecutor('communication.sms', new SmsExecutor(simulatedSmsProvider, connectorManager, recoveryActionRepository));
toolExecutorFactory.registerExecutor('payment_link.create', new RazorpayLinkExecutor(connectorManager, recoveryActionRepository));
toolExecutorFactory.registerExecutor('recovery.escalate', new EscalateRecoveryExecutor(recoveryCaseRepository, recoveryActionRepository, cacheService));
toolExecutorFactory.registerExecutor('recovery.schedule', new ScheduleRecoveryExecutor(recoveryCaseRepository, recoveryScheduleRepository, recoveryActionRepository, outboxEventRepository, cacheService));

const agentExecutionRepository = new PrismaAgentExecutionRepository(prisma);

const toolExecutionService = new ToolExecutionService(
    toolExecutorFactory,
    agentExecutionRepository,
    cacheService
);

const toolAdapter = new ToolAdapter(toolExecutionService);
const agentNode = new AgentNode(toolAdapter);
const policyEvaluator = new PolicyEvaluator();

const agentGraph = createAgentGraph(agentNode, toolAdapter, policyEvaluator, agentExecutionRepository);

export const toolRegistry = new MemoryToolRegistry();
import { skillRegistry, skillSelector } from './skills.config.js';
export { skillRegistry, skillSelector };
export const skillValidator = new SkillValidator();
const skillLoader = new SkillLoader(skillRegistry, skillSelector, skillValidator);
const policyContextBuilder = new PolicyContextBuilder();
const dynamicToolResolver = new DynamicToolResolver(toolRegistry);

export const contextAssembler = new ContextAssembler(skillLoader, policyContextBuilder, dynamicToolResolver);

export const agentService = new LangchainAgentService(agentGraph);

export default agentService;
