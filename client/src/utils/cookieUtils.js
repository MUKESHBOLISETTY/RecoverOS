export function getCookie(name) {
    if (name === 'access_token') {
        const token = localStorage.getItem('token');
        if (token) return token;
    }
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
