// axiom-orders/public/js/api/settingsAPI.js

export async function getCompanySettings() {
    try {
    const token = (typeof window !== 'undefined' && typeof window.getAxiomToken === 'function') ? window.getAxiomToken() : null;
        const response = await fetch('/api/settings/company', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch company settings:', error);
        return { success: false, message: 'فشل تحميل الإعدادات' };
    }
}

export async function updateCompanySettings(settingsData) {
    try {
    const token = (typeof window !== 'undefined' && typeof window.getAxiomToken === 'function') ? window.getAxiomToken() : null;
        const response = await fetch('/api/settings/company', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(settingsData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to update company settings:', error);
        return { success: false, message: error.message };
    }
}

export async function getAvailableRoles() {
    try {
    const token = (typeof window !== 'undefined' && typeof window.getAxiomToken === 'function') ? window.getAxiomToken() : null;
        const response = await fetch('/api/settings/roles', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch available roles:', error);
        return { success: false, message: 'فشل تحميل الأدوار المتاحة' };
    }
}