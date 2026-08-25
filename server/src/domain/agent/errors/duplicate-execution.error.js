export class DuplicateExecutionError extends Error {
    constructor(agentId, eventId) {
        super(`Execution already exists for Agent ${agentId} and Event ${eventId}`);
        this.name = 'DuplicateExecutionError';
        this.agentId = agentId;
        this.eventId = eventId;
    }
}
