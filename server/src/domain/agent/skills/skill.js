export class Skill {
    /**
     * @param {Object} data
     * @param {string} data.id
     * @param {number} data.version
     * @param {string} data.purpose
     * @param {string[]} data.supportedEvents
     * @param {string[]} data.requiredContext
     * @param {string[]} data.toolCategories
     * @param {string[]} data.instructions
     */
    constructor(data) {
        this.id = data.id;
        this.version = data.version;
        this.purpose = data.purpose;
        this.supportedEvents = data.supportedEvents || [];
        this.requiredContext = data.requiredContext || [];
        this.toolCategories = data.toolCategories || [];
        this.instructions = data.instructions || [];
    }
}

export default Skill;
