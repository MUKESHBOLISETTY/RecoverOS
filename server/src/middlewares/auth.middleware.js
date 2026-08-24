import { AuthService } from '../domain/auth/auth.service.js';

const authService = new AuthService();

export const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");
        const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
        if (!token) {
            return res.status(401).json({ success: false, message: "Access denied. No token provided." });
        }
        
        const { user, sessionId } = await authService.verifySession(token);
        
        req.user = user;
        req.sessionId = sessionId;
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        res.status(401).json({ success: false, message: "Unauthorized access." });
    }
};
