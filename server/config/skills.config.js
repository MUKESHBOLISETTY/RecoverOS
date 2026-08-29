import MemorySkillRegistry from '../src/domain/agent/skills/memory-skill.registry.js';
import SkillSelector from '../src/domain/agent/skills/skill-selector.js';

export const skillRegistry = new MemorySkillRegistry();
export const skillSelector = new SkillSelector();
