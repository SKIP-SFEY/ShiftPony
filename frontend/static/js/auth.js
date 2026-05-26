function renderAuthScreen(startMessage = '') {
    appContainer.innerHTML = `
        <div class="container" style="max-width: 500px; margin: 50px auto;">
            <div class="header" style="justify-content: center; border-bottom: none;">
                <div class="logo">Планировщик смен</div>
            </div>

            <div class="content">
                <h2 style="margin-bottom: 24px;">Войдите для продолжения</h2>

                <div style="margin-bottom: 20px;">
                    <input
                        type="text"
                        id="loginInput"
                        placeholder="Логин"
                        autocomplete="username"
                        style="width:100%; padding:14px; border-radius: 40px; border:1px solid #cbd5e1; margin-bottom:12px;"
                    >

                    <input
                        type="password"
                        id="passwordInput"
                        placeholder="Пароль"
                        autocomplete="current-password"
                        style="width:100%; padding:14px; border-radius: 40px; border:1px solid #cbd5e1;"
                    >
                </div>

                <button
                    id="doLoginBtn"
                    style="background:#1e293b; color:white; width:100%; padding:12px; border-radius:60px; font-weight:bold; border:none; cursor:pointer;"
                >
                    Войти
                </button>

                <div id="loginError" style="display:${startMessage ? 'block' : 'none'}; margin-top:16px; color:#dc2626; font-weight:600;">${escapeHtml(startMessage)}</div>
            </div>
        </div>
    `;

    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginButton = document.getElementById('doLoginBtn');
    const loginError = document.getElementById('loginError');

    async function handleLogin() {
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();

        loginError.style.display = 'none';
        loginError.textContent = '';

        if (!login || !password) {
            loginError.textContent = 'Введите логин и пароль';
            loginError.style.display = 'block';
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = 'Вход...';

        try {
            const session = await loginUser(login, password);
            setUrlForSession(session);

            if (session.role === 'admin') {
                await renderAdminPanel();
            } else {
                await renderUserPanel();
            }
        } catch (error) {
            loginError.textContent = error.message || 'Неверный логин или пароль';
            loginError.style.display = 'block';
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Войти';
        }
    }

    loginButton.addEventListener('click', handleLogin);

    passwordInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
}
