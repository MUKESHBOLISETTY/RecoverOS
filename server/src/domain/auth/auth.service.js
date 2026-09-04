import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * @typedef {import('../user/user.repository.js').UserRepository} UserRepository
 * @typedef {import('../user/device-session.repository.js').DeviceSessionRepository} DeviceSessionRepository
 */

export class AuthService {
    /**
     * @param {UserRepository} userRepository
     * @param {DeviceSessionRepository} deviceSessionRepository
     * @param {import('../agent/agent-provisioning.service.js').AgentProvisioningService} agentProvisioningService
     */
    constructor(userRepository, deviceSessionRepository, agentProvisioningService) {
        if (!userRepository) throw new Error('AuthService: userRepository is required');
        if (!deviceSessionRepository) throw new Error('AuthService: deviceSessionRepository is required');
        this.userRepository = userRepository;
        this.deviceSessionRepository = deviceSessionRepository;
        this.agentProvisioningService = agentProvisioningService;
        this.jwtSecret = process.env.JWT_SECRET;
        this.sessionPrefix = 'session:';
    }

    async register(email, password, deviceName = 'Unknown Device', ipAddress = null) {
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await this.userRepository.create({
            email,
            password: hashedPassword,
            emailVerified: true
        });

        if (this.agentProvisioningService) {
            await this.agentProvisioningService.provisionDefaultAgent(user.id);
        }

        return this._createSession(user, deviceName, ipAddress);
    }

    async login(email, password, deviceName = 'Unknown Device', ipAddress = null) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }

        return this._createSession(user, deviceName, ipAddress);
    }

    async verifySession(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            const sessionId = decoded.sessionId;

            const activeSession = await this.deviceSessionRepository.findById(sessionId);
            if (!activeSession) {
                throw new Error('Device logged out');
            }

            const user = await this.userRepository.findById(decoded.userId);
            if (!user) {
                throw new Error('User no longer exists');
            }

            return { user, sessionId };
        } catch (error) {
            throw new Error('Unauthorized');
        }
    }

    async logout(sessionId) {
        await this.deviceSessionRepository.delete(sessionId);
    }

    async _createSession(user, deviceName, ipAddress) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const newSession = await this.deviceSessionRepository.create({
            userId: user.id,
            deviceName,
            ipAddress,
            expiresAt
        });

        const payload = { userId: user.id, sessionId: newSession.id, email: user.email };
        const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });

        return {
            user: {
                id: user.id,
                email: user.email,
                emailVerified: user.emailVerified
            },
            token
        };
    }
}
