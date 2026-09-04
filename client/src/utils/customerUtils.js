export const getCustomerName = (caseData) => {
    if (!caseData) return 'Unknown';
    
    const customer = caseData.contextSnapshot?.customer;
    if (customer?.name) {
        return customer.name;
    }
    
    if (customer?.email) {
        return customer.email;
    }

    if (caseData.customerEmail) {
        return caseData.customerEmail;
    }

    if (caseData.customerId) {
        return caseData.customerId;
    }
    
    return 'Unknown';
};
