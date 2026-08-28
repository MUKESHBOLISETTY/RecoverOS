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

const toolExecutorFactory = new ToolExecutorFactory();

toolExecutorFactory.registerExecutor('communication.email', new GmailEmailExecutor());
toolExecutorFactory.registerExecutor('payment_link.create', new RazorpayLinkExecutor());
toolExecutorFactory.registerExecutor('communication.whatsapp', new WhatsAppMessageExecutor());

const recoveryCaseRepository = new PrismaRecoveryCaseRepository(prisma);
const recoveryActionRepository = new PrismaRecoveryActionRepository(prisma);
const recoveryScheduleRepository = new PrismaRecoveryScheduleRepository(prisma);
const outboxEventRepository = new PrismaOutboxEventRepository(prisma);

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

export const agentService = new LangchainAgentService(agentGraph);

export default agentService;
