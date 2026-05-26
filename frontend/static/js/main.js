document.addEventListener('DOMContentLoaded', async () => {
    if (!appContainer) {
        console.error('Не найден элемент #appContainer');
        return;
    }

    if (!currentSession || !getToken()) {
        renderAuthScreen();
        return;
    }

    try {
        if (currentSession.role === 'admin') {
            const tabFromUrl = new URLSearchParams(window.location.search).get('tab');
            const allowedTabs = ['dashboard', 'employees', 'equipment', 'schedule', 'profile'];

            if (allowedTabs.includes(tabFromUrl)) {
                activeAdminTab = tabFromUrl;
            }

            await renderAdminPanel();
        } else if (currentSession.role === 'user') {
            if (window.location.pathname.endsWith('/profile')) {
                await renderUserProfilePanel();
            } else {
                await renderUserPanel();
            }
        } else {
            logout();
            setLoginUrl();
            renderAuthScreen();
        }
    } catch (error) {
        console.error(error);
        logout();
        setLoginUrl();
        renderAuthScreen();
    }
});
