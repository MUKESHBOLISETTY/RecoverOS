export class SubjectContextRegistry {
    constructor() {
        this.providers = new Map();
    }

    /**
     * @param {string} subjectType
     * @param {import('./subject-context-provider.interface.js').SubjectContextProviderInterface} provider
     */
    register(subjectType, provider) {
        this.providers.set(subjectType, provider);
    }

    /**
     * @param {string} subjectType
     * @returns {import('./subject-context-provider.interface.js').SubjectContextProviderInterface}
     */
    get(subjectType) {
        const provider = this.providers.get(subjectType);
        if (!provider) {
            throw new Error(`[SubjectContextRegistry] No provider registered for subjectType: ${subjectType}`);
        }
        return provider;
    }
}
