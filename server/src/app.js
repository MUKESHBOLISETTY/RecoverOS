import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import "dotenv/config";
import helmet from 'helmet';
import webhookRoutes from './routes/webhook.routes.js';
import { connectDB } from '../config/database.config.js';
import { connectRedis } from '../config/redis.config.js';

const app = express();
connectDB();
connectRedis();

app.use(express.json());
app.use(cookieParser());

app.use(helmet());

const corsoptions = {
    origin: process.env.origin,
    methods: "GET, POST, PUT, DELETE, HEAD, PATCH",
    credentials: true,
};
app.use(cors(corsoptions));
app.set('trust proxy', 1);

app.use('/webhooks', webhookRoutes);

app.get('/', (req, res) => {
    return res.json({
        success: true,
        message: "Your server is up and running",
    });
});

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: "Bad Request: Malformed JSON"
        });
    }
    res.status(err.statusCode || 500).json({
        success: false,
        message: "An unexpected error occurred on the server."
    });
});

export default app;