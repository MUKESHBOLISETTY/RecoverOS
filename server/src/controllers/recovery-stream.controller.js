import { pubsubService } from '../../config/redis.config.js';

export const subscribeToRecoveryEvents = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const channel = `recoveros:recovery-events:user:${userId}`;
    console.log(`[SSE Controller] Client connected. Subscribing to channel: ${channel}`);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Subscribed to recovery stream' })}\n\n`);

    const listener = (message) => {
        console.log(`[SSE Controller] Received message on channel ${channel}`);
        let parsed = typeof message === 'string' ? null : message;
        if (!parsed) {
            try {
                parsed = JSON.parse(message);
            } catch (e) {
                parsed = message;
            }
        }
        
        if (parsed && typeof parsed === 'object') {
            if (parsed.type) res.write(`event: ${parsed.type}\n`);
            if (parsed.eventId) res.write(`id: ${parsed.eventId}\n`);
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
        } else {
            res.write(`data: ${typeof message === 'string' ? message : JSON.stringify(message)}\n\n`);
        }
    };

    try {
        await pubsubService.subscribe(channel, listener);
    } catch (err) {
        console.error(`[SSE Controller] Failed to subscribe to channel ${channel}:`, err.message);
        res.end();
        return;
    }

    const keepAlive = setInterval(() => {
        res.write(':\n\n');
    }, 15000);

    req.on('close', async () => {
        clearInterval(keepAlive);
        try {
            await pubsubService.unsubscribe(channel, listener);
        } catch (err) {
            console.error(`[SSE Controller] Error unsubscribing from channel ${channel}:`, err.message);
        }
    });
};
