
function renderUserShell(message = 'Загрузка...') {
    appContainer.innerHTML = `
        <div class="header">
            <div class="logo">Планировщик смен</div>
            <div class="header-actions">
                <button class="profile-btn" id="userProfileBtn">Профиль</button>
                <button class="logout-btn" id="userLogoutBtn">Выход</button>
            </div>
        </div>
        <div class="content">
            <div class="empty-msg">${escapeHtml(message)}</div>
        </div>
    `;

    attachUserHeaderHandlers();
}

function renderUserAccountError(text) {
    appContainer.innerHTML = `
        <div class="header">
            <div class="logo">Планировщик смен</div>
            <div class="header-actions">
                <button class="logout-btn" id="userLogoutBtn">Выход</button>
            </div>
        </div>
        <div class="content">
            <div class="user-error">
                <div class="user-error-title">Ошибка аккаунта</div>
                <div>${escapeHtml(text)}</div>
            </div>
        </div>
    `;

    attachUserHeaderHandlers();
}

async function loadUserProfileOrShowError() {
    try {
        const profile = await getCurrentProfile();

        if (!profile.employeeId || !profile.employeeName) {
            renderUserAccountError(
                'К этому пользователю больше не привязан сотрудник. Возможно, сотрудника удалили в админке. Обратитесь к администратору или войдите под другим аккаунтом.'
            );
            return null;
        }

        saveSession({
            ...currentSession,
            employeeId: profile.employeeId,
            name: profile.employeeName
        });

        return profile;
    } catch (error) {
        console.error(error);
        clearSession();
        renderAuthScreen('Сессия недействительна или пользователь был удалён. Войдите заново.');
        return null;
    }
}

async function renderUserPanel() {
    if (!currentSession || currentSession.role !== 'user') {
        setLoginUrl();
        renderAuthScreen();
        return;
    }

    setBrowserUrl(getUserBasePath());
    renderUserShell('Загрузка...');

    const profile = await loadUserProfileOrShowError();
    if (!profile) return;

    const employeeId = profile.employeeId;

    try {
        const [employee, allShifts, upcomingShifts, equipmentCount] = await Promise.all([
            getEmployeeById(employeeId),
            getShiftsForEmployee(employeeId),
            getUpcomingShifts(employeeId),
            getEmployeeEquipmentCount(employeeId)
        ]);

        if (!employee) {
            renderUserAccountError(
                'Сотрудник, который был привязан к этому аккаунту, не найден. Возможно, его удалили в админке.'
            );
            return;
        }

        const upcomingHtml = upcomingShifts.length
            ? upcomingShifts.map(shift => `
                <div class="shift-item">
                    <strong>${escapeHtml(shift.date)}</strong> — ${escapeHtml(shift.time)}<br>
                    Оборудование: ${escapeHtml(shift.equipment_name || '—')} |
                    Статус: ${escapeHtml(shift.status)}
                </div>
            `).join('')
            : '<div class="empty-msg">Нет предстоящих смен</div>';

        appContainer.innerHTML = `
            <div class="header">
                <div class="logo">Планировщик смен</div>
                <div class="header-actions">
                    <button class="profile-btn" id="userProfileBtn">Профиль</button>
                    <button class="logout-btn" id="userLogoutBtn">Выход</button>
                </div>
            </div>

            <div class="content">
                <div class="welcome-section">
                    <div class="employee-name">${escapeHtml(employee.name)}</div>
                    <div class="badge">Сотрудник</div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${allShifts.length}</div>
                        <div class="stat-label">Всего смен</div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-number">${upcomingShifts.length}</div>
                        <div class="stat-label">Предстоящие</div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-number">${equipmentCount}</div>
                        <div class="stat-label">Оборудование</div>
                    </div>
                </div>

                <h3>Предстоящие смены</h3>
                ${upcomingHtml}
            </div>

            <footer>Ваше персональное расписание</footer>
        `;

        attachUserHeaderHandlers();
    } catch (error) {
        console.error(error);
        renderUserAccountError(error.message || 'Ошибка загрузки данных');
    }
}

function attachUserHeaderHandlers() {
    document.getElementById('userLogoutBtn')?.addEventListener('click', () => {
        logout();
        setLoginUrl();
        renderAuthScreen();
    });

    document.getElementById('userProfileBtn')?.addEventListener('click', () => {
        renderUserProfilePanel().catch(showError);
    });

    document.getElementById('backToScheduleBtn')?.addEventListener('click', () => {
        renderUserPanel().catch(showError);
    });
}

async function renderUserProfilePanel() {
    if (!currentSession || currentSession.role !== 'user') {
        setLoginUrl();
        renderAuthScreen();
        return;
    }

    setBrowserUrl(`${getUserBasePath()}/profile`);

    appContainer.innerHTML = `
        <div class="header">
            <div class="logo">Планировщик смен</div>
            <div class="header-actions">
                <button class="profile-btn" id="backToScheduleBtn">К расписанию</button>
                <button class="logout-btn" id="userLogoutBtn">Выход</button>
            </div>
        </div>
        <div class="content">
            <div class="empty-msg">Загрузка профиля...</div>
        </div>
    `;

    attachUserHeaderHandlers();

    try {
        const profile = await getCurrentProfile();

        if (!profile.employeeId || !profile.employeeName) {
            renderUserAccountError(
                'К этому пользователю больше не привязан сотрудник. Возможно, сотрудника удалили в админке.'
            );
            return;
        }

        appContainer.innerHTML = `
            <div class="header">
                <div class="logo">Планировщик смен</div>
                <div class="header-actions">
                    <button class="profile-btn" id="backToScheduleBtn">К расписанию</button>
                    <button class="logout-btn" id="userLogoutBtn">Выход</button>
                </div>
            </div>

            <div class="content">
                <h2>Профиль пользователя</h2>

                <div class="profile-card">
                    <h3>Данные аккаунта</h3>

                    <div class="profile-row">
                        <span class="profile-label">Логин</span>
                        <span class="profile-value">${escapeHtml(profile.login)}</span>
                    </div>
                    <div class="profile-row">
                        <span class="profile-label">Роль</span>
                        <span class="profile-value">${escapeHtml(profile.role)}</span>
                    </div>
                    <div class="profile-row">
                        <span class="profile-label">Сотрудник</span>
                        <span class="profile-value">${escapeHtml(profile.employeeName)}</span>
                    </div>
                    <div class="profile-row">
                        <span class="profile-label">Email</span>
                        <span class="profile-value">${escapeHtml(profile.employeeEmail || '—')}</span>
                    </div>
                    <div class="profile-row">
                        <span class="profile-label">Телефон</span>
                        <span class="profile-value">${escapeHtml(profile.employeePhone || '—')}</span>
                    </div>
                </div>

                <button class="add-btn" id="refreshUserTokenBtn">Обновить JWT токен</button>
                <div class="profile-message" id="userProfileMessage"></div>
            </div>
        `;

        attachUserHeaderHandlers();

        document.getElementById('refreshUserTokenBtn')?.addEventListener('click', async () => {
            try {
                await refreshCurrentToken();
                const message = document.getElementById('userProfileMessage');
                if (message) message.textContent = 'Токен обновлен, можно продолжать работу.';
            } catch (error) {
                showError(error, 'Не удалось обновить токен');
            }
        });
    } catch (error) {
        console.error(error);
        clearSession();
        renderAuthScreen('Сессия недействительна или пользователь был удалён. Войдите заново.');
    }
}
