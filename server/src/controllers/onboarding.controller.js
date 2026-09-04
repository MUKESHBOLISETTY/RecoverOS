import prisma from '../../config/database.config.js';

class OnboardingController {
  getStatus = async (req, res) => {
    try {
      const userId = req.user.id;

      const credentials = await prisma.connectorCredential.findMany({
        where: { userId },
        select: { connectorId: true }
      });

      const connectorIds = credentials.map(c => c.connectorId.toLowerCase());

      const shopifyConnected = connectorIds.includes('shopify');
      const razorpayConnected = connectorIds.includes('razorpay');

      const agent = await prisma.agent.findFirst({
        where: {
          userId: userId,
          name: 'Revenue Recovery Agent',
          status: 'ACTIVE'
        }
      });

      const agentProvisioned = !!agent;

      const rules = (agent && typeof agent.rules === 'object') ? agent.rules : {};
      const policyConfigured = !!rules.policyConfigured;
      const selectedCommunicationChannels = Array.isArray(rules.communicationChannels) ? rules.communicationChannels : [];

      const communicationConnections = {
        EMAIL: connectorIds.includes('gmail'),
        SMS: connectorIds.includes('google_sheets'),
      };

      const requiredConnections = [];
      if (selectedCommunicationChannels.includes('EMAIL')) {
        requiredConnections.push('EMAIL');
      }
      if (selectedCommunicationChannels.includes('SMS')) {
        requiredConnections.push('SMS');
      }

      const requiredCommunicationConnectionsConnected = requiredConnections.every(ch => communicationConnections[ch]);

      const requiredCommerceConnectionsConnected = shopifyConnected && razorpayConnected;
      const merchantEligible = true;

      const isReady =
        agentProvisioned &&
        requiredCommerceConnectionsConnected &&
        policyConfigured &&
        requiredCommunicationConnectionsConnected &&
        merchantEligible;

      res.json({
        success: true,
        data: {
          shopifyConnected,
          razorpayConnected,
          agentProvisioned,
          policyConfigured,
          selectedCommunicationChannels,
          communicationConnections,
          requiredConnections,
          isReady
        }
      });
    } catch (error) {
      console.error('Error fetching onboarding status:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch onboarding status' });
    }
  };
}

export default OnboardingController;
