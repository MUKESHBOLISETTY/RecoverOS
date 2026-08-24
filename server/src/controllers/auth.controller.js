import { AuthService } from '../domain/auth/auth.service.js';

const authService = new AuthService();

export class AuthController {
    static async register(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
            }

            const deviceName = req.headers['user-agent'] || 'Unknown Device';
            const ipAddress = req.ip || req.connection.remoteAddress;

            const result = await authService.register(email, password, deviceName, ipAddress);
            return res.status(201).json({
                success: true,
                message: "User registered successfully",
                data: result
            });
        } catch (error) {
            if (error.message === 'User already exists') {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    static async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
            }

            const deviceName = req.headers['user-agent'] || 'Unknown Device';
            const ipAddress = req.ip || req.connection.remoteAddress;

            const result = await authService.login(email, password, deviceName, ipAddress);
            return res.status(200).json({
                success: true,
                message: "User logged in successfully",
                data: result
            });
        } catch (error) {
            if (error.message === 'Invalid email or password') {
                return res.status(401).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    static async logout(req, res, next) {
        try {
            const { sessionId } = req;
            if (sessionId) {
                await authService.logout(sessionId);
            }
            return res.status(200).json({
                success: true,
                message: "Logged out successfully"
            });
        } catch (error) {
            next(error);
        }
    }
}
