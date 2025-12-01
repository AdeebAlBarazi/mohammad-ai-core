// ORIGINAL_PATH: /Coreflowhub/js/auth.js
// Trimmed copy for organization; keep original for now.
function initializeAuthPage(setLangFunc) {
    const API_URL = 'http://localhost:3000/api/auth';
    const loginForm = document.getElementById('login-form');
    const loginErrorMessage = document.getElementById('login-error-message');
    const showMessage = (el, msg) => { if (!el) return; el.textContent = msg; el.style.display = 'block'; };
    const hideMessages = () => { if (loginErrorMessage) { loginErrorMessage.textContent = ''; loginErrorMessage.style.display = 'none'; } };

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessages();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());
            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('axiomUserToken', result.token);
                    localStorage.setItem('axiomUserData', JSON.stringify(result.user));
                    localStorage.setItem('axiomUserName', result.user.fullName);
                    const urlParams = new URLSearchParams(window.location.search);
                    const redirectUrl = urlParams.get('redirect');
                    window.location.href = redirectUrl || 'index.html';
                } else {
                    showMessage(loginErrorMessage, result.error || 'فشل تسجيل الدخول.');
                }
            } catch (error) { showMessage(loginErrorMessage, 'حدث خطأ في الشبكة.'); }
        });
    }
    const savedLang = localStorage.getItem('language') || 'ar';
    if (setLangFunc) setLangFunc(savedLang);
}
