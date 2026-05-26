let activeAdminTab = 'dashboard';
let dashboardCharts = [];

const EQUIPMENT_STATUSES = [
    'Исправно',
    'На ремонте',
    'Выдано',
    'На складе',
    'Списано'
]
function makeEquipmentStatusOptions(currentStatus) {
    let status = currentStatus || 'Исправно';
    let html = '';

    for (let i = 0; i < EQUIPMENT_STATUSES.length; i++) {
        let item = EQUIPMENT_STATUSES[i];
        let selected = '';

        if (item === status) {
            selected = 'selected';
        }

        html += `<option value="${escapeHtml(item)}" ${selected}>${escapeHtml(item)}</option>`;
    }

    return html;
}


function equipmentStatusCell(item) {
    return `
        <select class="table-status-select eq-status-select" data-id="${item.id}">
            ${makeEquipmentStatusOptions(item.status)}
        </select>
    `;
}

async function renderAdminPanel() {
    if (!currentSession || currentSession.role !== 'admin') {
        setLoginUrl();
        renderAuthScreen();
        return;
    }

    const tabPart = activeAdminTab && activeAdminTab !== 'dashboard' ? `?tab=${encodeURIComponent(activeAdminTab)}` : '';
    setBrowserUrl(`/admin${tabPart}`);

    const navButtons = `
        <div class="admin-nav">
            <button class="nav-tab ${activeAdminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Панель управления</button>
            <button class="nav-tab ${activeAdminTab === 'employees' ? 'active' : ''}" data-tab="employees">Сотрудники</button>
            <button class="nav-tab ${activeAdminTab === 'equipment' ? 'active' : ''}" data-tab="equipment">Оборудование</button>
            <button class="nav-tab ${activeAdminTab === 'schedule' ? 'active' : ''}" data-tab="schedule">Расписание</button>
            <button class="nav-tab ${activeAdminTab === 'profile' ? 'active' : ''}" data-tab="profile">Профиль</button>
        </div>
    `;

    appContainer.innerHTML = `
        <div class="header">
            <div class="logo">Планировщик смен — Админ</div>
            <button class="logout-btn" id="adminLogoutBtn">Выход</button>
        </div>
        ${navButtons}
        <div class="content" id="adminDynamicContent">
            <div class="empty-msg">Загрузка...</div>
        </div>
    `;

    document.getElementById('adminLogoutBtn').addEventListener('click', () => {
        logout();
        setLoginUrl();
        renderAuthScreen();
    });

    document.querySelectorAll('.nav-tab').forEach(button => {
        button.addEventListener('click', async () => {
            activeAdminTab = button.getAttribute('data-tab');
            await renderAdminPanel();
        });
    });

    const content = document.getElementById('adminDynamicContent');

    try {
        if (activeAdminTab === 'dashboard') {
            content.innerHTML = await renderDashboardContent();
        } else if (activeAdminTab === 'employees') {
            content.innerHTML = await renderEmployeesContent();
        } else if (activeAdminTab === 'equipment') {
            content.innerHTML = await renderEquipmentContent();
        } else if (activeAdminTab === 'schedule') {
            content.innerHTML = await renderScheduleContent();
        } else if (activeAdminTab === 'profile') {
            content.innerHTML = await renderProfileContent();
        }

        attachAdminEventHandlers();

        if (activeAdminTab === 'dashboard') {
            await renderDashboardCharts();
        }
    } catch (error) {
        console.error(error);
        content.innerHTML = `<div class="empty-msg">${escapeHtml(error.message || 'Ошибка загрузки данных')}</div>`;
    }
}


async function renderDashboardContent() {
    const [stats, todayShifts] = await Promise.all([
        getAdminStats(),
        getTodayShiftsList()
    ]);

    let todayHtml = '';

    if (!todayShifts.length) {
        todayHtml = '<div class="empty-msg">Нет смен на сегодня</div>';
    } else {
        todayHtml = `
            <div style="margin-top:12px;">
                <ul style="margin-left:20px;">
                    ${todayShifts.map(shift => `
                        <li>
                            ${escapeHtml(shift.employeeName || shift.employee_name || 'Неизвестно')}
                            — ${escapeHtml(shift.date)} ${escapeHtml(shift.time)}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    return `
        <h2>Панель управления</h2>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.employeesCount ?? 0}</div>
                <div class="stat-label">Сотрудников</div>
            </div>

            <div class="stat-card">
                <div class="stat-number">${stats.equipmentCount ?? 0}</div>
                <div class="stat-label">Оборудование</div>
            </div>

            <div class="stat-card">
                <div class="stat-number">${stats.totalShifts ?? 0}</div>
                <div class="stat-label">Всего смен</div>
            </div>

            <div class="stat-card">
                <div class="stat-number">${stats.shiftsToday ?? 0}</div>
                <div class="stat-label">Смен сегодня</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <h3>Смены по статусам</h3>
                <div class="chart-box">
                    <canvas id="shiftsStatusChart"></canvas>
                    <div class="empty-msg" id="shiftsChartFallback" style="display:none;">Диаграмма недоступна</div>
                </div>
            </div>

            <div class="chart-card">
                <h3>Оборудование по статусам</h3>
                <div class="chart-box">
                    <canvas id="equipmentStatusChart"></canvas>
                    <div class="empty-msg" id="equipmentChartFallback" style="display:none;">Диаграмма недоступна</div>
                </div>
            </div>
        </div>

        <h3>Смены сегодня</h3>
        ${todayHtml}
    `;
}

async function renderDashboardCharts() {
    dashboardCharts.forEach(chart => chart.destroy());
    dashboardCharts = [];

    const shiftsCanvas = document.getElementById('shiftsStatusChart');
    const equipmentCanvas = document.getElementById('equipmentStatusChart');

    if (!shiftsCanvas || !equipmentCanvas) return;

    if (!window.Chart) {
        document.getElementById('shiftsChartFallback').style.display = 'block';
        document.getElementById('equipmentChartFallback').style.display = 'block';
        return;
    }

    const [shiftsByStatus, equipmentByStatus] = await Promise.all([
        getShiftsByStatus(),
        getEquipmentByStatus()
    ]);

    const shiftsLabels = shiftsByStatus.map(item => item.status || 'Без статуса');
    const shiftsValues = shiftsByStatus.map(item => Number(item.count || 0));
    const equipmentLabels = equipmentByStatus.map(item => item.status || 'Без статуса');
    const equipmentValues = equipmentByStatus.map(item => Number(item.count || 0));

    if (!shiftsLabels.length) {
        document.getElementById('shiftsChartFallback').style.display = 'block';
    } else {
        dashboardCharts.push(new Chart(shiftsCanvas, {
            type: 'bar',
            data: {
                labels: shiftsLabels,
                datasets: [{
                    label: 'Количество смен',
                    data: shiftsValues
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        }));
    }

    if (!equipmentLabels.length) {
        document.getElementById('equipmentChartFallback').style.display = 'block';
    } else {
        dashboardCharts.push(new Chart(equipmentCanvas, {
            type: 'doughnut',
            data: {
                labels: equipmentLabels,
                datasets: [{
                    label: 'Оборудование',
                    data: equipmentValues
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }));
    }
}

async function renderProfileContent() {
    const profile = await getCurrentProfile();

    return `
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
                <span class="profile-value">${escapeHtml(profile.employeeName || 'Не привязан')}</span>
            </div>
            <div class="profile-row">
                <span class="profile-label">Email</span>
                <span class="profile-value">${escapeHtml(profile.employeeEmail || '—')}</span>
            </div>
        </div>

        <button class="add-btn" id="refreshTokenBtn">Обновить JWT токен</button>
        <div class="profile-message" id="profileMessage"></div>
    `;
}


async function renderEmployeesContent() {
    const employees = await fetchEmployees({ page_size: 100 });

    const rows = employees.map(employeeRow).join('');

    return `
        <h2>Сотрудники</h2>

        <div class="toolbar">
            <input id="employeeSearchInput" placeholder="Поиск по имени, email или логину">
            <button class="add-btn" id="employeeSearchBtn">Найти</button>
            <button class="add-btn" id="addEmployeeBtn">+ Добавить сотрудника</button>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Телефон</th>
                        <th>Email</th>
                        <th>Логин</th>
                        <th>Навыки</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>${rows || showEmptyRow(6, 'Нет сотрудников')}</tbody>
            </table>
        </div>
    `;
}

function employeeRow(employee) {
    return `
        <tr>
            <td>${escapeHtml(employee.name)}</td>
            <td>${escapeHtml(employee.phone)}</td>
            <td>${escapeHtml(employee.email)}</td>
            <td>${escapeHtml(employee.login || '—')}</td>
            <td>${escapeHtml(employee.skills)}</td>
            <td>
                <button class="action-btn edit-emp" data-id="${employee.id}">Изменить</button>
                <button class="action-btn delete-emp" data-id="${employee.id}">Удалить</button>
            </td>
        </tr>
    `;
}

async function rerenderEmployeesWithSearch() {
    const search = document.getElementById('employeeSearchInput')?.value.trim() || '';
    const employees = await fetchEmployees({ search, page_size: 100 });

    const tbody = document.querySelector('#adminDynamicContent tbody');
    if (!tbody) return;

    tbody.innerHTML = employees.map(employeeRow).join('') || showEmptyRow(6, 'Ничего не найдено');

    attachAdminEventHandlers();
}


async function renderEquipmentContent() {
    const equipment = await fetchEquipment({ page_size: 100 });

    const rows = equipment.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.serial_number)}</td>
            <td>${escapeHtml(item.location)}</td>
            <td>${equipmentStatusCell(item)}</td>
            <td>
                <button class="action-btn edit-eq" data-id="${item.id}">Изменить</button>
                <button class="action-btn delete-eq" data-id="${item.id}">Удалить</button>
            </td>
        </tr>
    `).join('');

    return `
        <h2>Оборудование</h2>

        <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
            <input id="equipmentSearchInput" placeholder="Поиск по названию или серийному номеру" style="flex:1; min-width:220px; padding:12px; border-radius:24px; border:1px solid #cbd5e1;">
            <button class="add-btn" id="equipmentSearchBtn">Найти</button>
            <button class="add-btn" id="addEquipmentBtn">+ Добавить оборудование</button>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Серийный номер</th>
                        <th>Местоположение</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>${rows || showEmptyRow(5, 'Нет оборудования')}</tbody>
            </table>
        </div>
    `;
}

async function rerenderEquipmentWithSearch() {
    const search = document.getElementById('equipmentSearchInput')?.value.trim() || '';
    const equipment = await fetchEquipment({ search, page_size: 100 });

    const tbody = document.querySelector('#adminDynamicContent tbody');
    if (!tbody) return;

    tbody.innerHTML = equipment.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.serial_number)}</td>
            <td>${escapeHtml(item.location)}</td>
            <td>${equipmentStatusCell(item)}</td>
            <td>
                <button class="action-btn edit-eq" data-id="${item.id}">Изменить</button>
                <button class="action-btn delete-eq" data-id="${item.id}">Удалить</button>
            </td>
        </tr>
    `).join('') || showEmptyRow(5, 'Ничего не найдено');

    attachAdminEventHandlers();
}


async function renderScheduleContent() {
    const shifts = await fetchShifts({ page_size: 100 });

    const rows = shifts.map(shift => `
        <tr>
            <td>${escapeHtml(shift.employee_name || '?')}</td>
            <td>${escapeHtml(shift.date)}</td>
            <td>${escapeHtml(shift.time)}</td>
            <td>${escapeHtml(shift.status)}</td>
            <td>${escapeHtml(shift.equipment_name || '—')}</td>
            <td>
                <button class="action-btn edit-shift" data-id="${shift.id}">Изменить</button>
                <button class="action-btn delete-shift" data-id="${shift.id}">Удалить</button>
            </td>
        </tr>
    `).join('');

    return `
        <h2>Расписание смен</h2>

        <div style="margin-bottom:16px;">
            <button class="add-btn" id="createShiftBtn">+ Создать смену</button>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Сотрудник</th>
                        <th>Дата</th>
                        <th>Время</th>
                        <th>Статус</th>
                        <th>Оборудование</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>${rows || showEmptyRow(6, 'Нет смен')}</tbody>
            </table>
        </div>
    `;
}

function attachAdminEventHandlers() {
    document.getElementById('addEmployeeBtn')?.addEventListener('click', () => showEmployeeModal());
    document.getElementById('addEquipmentBtn')?.addEventListener('click', () => showEquipmentModal());
    document.getElementById('createShiftBtn')?.addEventListener('click', () => showShiftModal());

    document.getElementById('employeeSearchBtn')?.addEventListener('click', () => rerenderEmployeesWithSearch().catch(showError));
    document.getElementById('equipmentSearchBtn')?.addEventListener('click', () => rerenderEquipmentWithSearch().catch(showError));

    document.querySelectorAll('.eq-status-select').forEach(select => {
        select.addEventListener('change', async () => {
            const id = Number(select.dataset.id);
            const status = select.value;
            const previousStatus = select.getAttribute('data-prev') || '';

            try {
                await updateEquipment(id, { status });
                select.setAttribute('data-prev', status);
                if (activeAdminTab === 'dashboard') {
                    await renderDashboardCharts();
                }
            } catch (error) {
                if (previousStatus) select.value = previousStatus;
                showError(error, 'Не удалось изменить статус оборудования');
            }
        });
        select.setAttribute('data-prev', select.value);
    });

    document.getElementById('refreshTokenBtn')?.addEventListener('click', async () => {
        try {
            await refreshCurrentToken();
            const message = document.getElementById('profileMessage');
            if (message) message.textContent = 'Токен обновлен, можно продолжать работу.';
        } catch (error) {
            showError(error, 'Не удалось обновить токен');
        }
    });

    document.querySelectorAll('.edit-emp').forEach(button => {
        button.addEventListener('click', async () => {
            const id = Number(button.dataset.id);
            const employee = await getEmployeeById(id);
            if (employee) showEmployeeModal(employee);
        });
    });

    document.querySelectorAll('.delete-emp').forEach(button => {
        button.addEventListener('click', async () => {
            const id = Number(button.dataset.id);
            if (!confirm('Удалить сотрудника? Это также удалит его смены.')) return;

            try {
                await deleteEmployee(id);
                await renderAdminPanel();
            } catch (error) {
                showError(error, 'Ошибка удаления сотрудника');
            }
        });
    });

    document.querySelectorAll('.edit-eq').forEach(button => {
        button.addEventListener('click', async () => {
            const id = Number(button.dataset.id);
            const equipment = await getEquipmentById(id);
            if (equipment) showEquipmentModal(equipment);
        });
    });

    document.querySelectorAll('.delete-eq').forEach(button => {
        button.addEventListener('click', async () => {
            const id = Number(button.dataset.id);
            if (!confirm('Удалить оборудование? Смены с ним останутся без оборудования.')) return;

            try {
                await deleteEquipment(id);
                await renderAdminPanel();
            } catch (error) {
                showError(error, 'Ошибка удаления оборудования');
            }
        });
    });

    document.querySelectorAll('.edit-shift').forEach(button => {
        button.addEventListener('click', async () => {
            const id = Number(button.dataset.id);
            const shift = await getShiftById(id);
            if (shift) showShiftModal(shift);
        });
    });

    document.querySelectorAll('.delete-shift').forEach(button => {
        button.addEventListener('click', async () => {
            const id = Number(button.dataset.id);
            if (!confirm('Удалить смену?')) return;

            try {
                await deleteShift(id);
                await renderAdminPanel();
            } catch (error) {
                showError(error, 'Ошибка удаления смены');
            }
        });
    });
}


function createModal(title, bodyHtml, onSave) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-card">
            <h3>${escapeHtml(title)}</h3>
            ${bodyHtml}
            <div class="modal-buttons">
                <button class="close-modal">Отмена</button>
                <button class="save-modal">Сохранить</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());

    modal.querySelector('.save-modal').addEventListener('click', async () => {
        try {
            await onSave(modal);
            modal.remove();
            await renderAdminPanel();
        } catch (error) {
            showError(error);
        }
    });

    return modal;
}

function showEmployeeModal(employee = null) {
    const isEdit = Boolean(employee);

    const accountFields = isEdit
        ? ``
        : `
            <hr>
            <p class="hint">Аккаунт для входа сотрудника</p>
            <input type="text" id="empLogin" placeholder="Логин для входа">
            <input type="password" id="empPassword" placeholder="Пароль для входа">
        `;

    createModal(
        isEdit ? 'Изменить сотрудника' : '+ Новый сотрудник',
        `
            <input type="text" id="empName" placeholder="Имя" value="${escapeHtml(employee?.name || '')}">
            <input type="text" id="empPhone" placeholder="Телефон" value="${escapeHtml(employee?.phone || '')}">
            <input type="email" id="empEmail" placeholder="Email" value="${escapeHtml(employee?.email || '')}">
            <textarea id="empSkills" placeholder="Навыки" rows="2">${escapeHtml(employee?.skills || '')}</textarea>
            ${accountFields}
        `,
        async () => {
            const data = {
                name: document.getElementById('empName').value.trim(),
                phone: document.getElementById('empPhone').value.trim(),
                email: document.getElementById('empEmail').value.trim(),
                skills: document.getElementById('empSkills').value.trim() || '—'
            };

            if (!data.name) {
                throw new Error('Введите имя сотрудника');
            }

            if (isEdit) {
                await updateEmployee(employee.id, data);
                return;
            }

            data.login = document.getElementById('empLogin').value.trim();
            data.password = document.getElementById('empPassword').value.trim();

            if (!data.login || !data.password) {
                throw new Error('Введите логин и пароль сотрудника');
            }

            if (data.login.length < 3) {
                throw new Error('Логин должен быть минимум 3 символа');
            }

            if (data.password.length < 4) {
                throw new Error('Пароль должен быть минимум 4 символа');
            }

            await createEmployee(data);
        }
    );
}

function showEquipmentModal(equipment = null) {
    const isEdit = Boolean(equipment);

    createModal(
        isEdit ? 'Изменить оборудование' : '+ Новое оборудование',
        `
            <input type="text" id="eqName" placeholder="Название" value="${escapeHtml(equipment?.name || '')}">
            <input type="text" id="eqSerial" placeholder="Серийный номер" value="${escapeHtml(equipment?.serial_number || '')}">
            <input type="text" id="eqLocation" placeholder="Местоположение" value="${escapeHtml(equipment?.location || '')}">

            <label class="field-label" for="eqStatus">Статус оборудования</label>
            <select id="eqStatus" class="equipment-status-select">
                ${makeEquipmentStatusOptions(equipment?.status || 'Исправно')}
            </select>
        `,
        async () => {
            const data = {
                name: document.getElementById('eqName').value.trim(),
                serial_number: document.getElementById('eqSerial').value.trim() || '—',
                location: document.getElementById('eqLocation').value.trim() || '—',
                status: document.getElementById('eqStatus').value.trim() || 'Исправно'
            };

            if (!data.name) {
                throw new Error('Введите название оборудования');
            }

            if (isEdit) {
                await updateEquipment(equipment.id, data);
            } else {
                await createEquipment(data);
            }
        }
    );
}

async function showShiftModal(shift = null) {
    const isEdit = Boolean(shift);
    const [employees, equipment] = await Promise.all([
        fetchEmployees({ page_size: 100 }),
        fetchEquipment({ page_size: 100 })
    ]);

    const employeeOptions = employees.map(employee => `
        <option value="${employee.id}" ${Number(shift?.employee_id) === Number(employee.id) ? 'selected' : ''}>
            ${escapeHtml(employee.name)}
        </option>
    `).join('');

    const equipmentOptions = equipment.map(item => `
        <option value="${item.id}" ${Number(shift?.equipment_id) === Number(item.id) ? 'selected' : ''}>
            ${escapeHtml(item.name)}
        </option>
    `).join('');

    createModal(
        isEdit ? 'Изменить смену' : '+ Новая смена',
        `
            <select id="shiftEmployee">
                <option value="">Выберите сотрудника</option>
                ${employeeOptions}
            </select>

            <input type="date" id="shiftDate" value="${escapeHtml(shift?.date || '')}">
            <input type="text" id="shiftTime" placeholder="Например: 09:00-18:00" value="${escapeHtml(shift?.time || '')}">

            <input type="text" id="shiftStatus" placeholder="Статус" value="${escapeHtml(shift?.status || 'Запланирована')}">

            <select id="shiftEquipment">
                <option value="">Без оборудования</option>
                ${equipmentOptions}
            </select>
        `,
        async () => {
            const employeeId = Number(document.getElementById('shiftEmployee').value);
            const equipmentValue = document.getElementById('shiftEquipment').value;

            const data = {
                employee_id: employeeId,
                date: document.getElementById('shiftDate').value,
                time: document.getElementById('shiftTime').value.trim(),
                status: document.getElementById('shiftStatus').value.trim() || 'Запланирована',
                equipment_id: equipmentValue ? Number(equipmentValue) : null
            };

            if (!data.employee_id) {
                throw new Error('Выберите сотрудника');
            }

            if (!data.date) {
                throw new Error('Выберите дату');
            }

            if (!data.time) {
                throw new Error('Введите время смены');
            }

            if (isEdit) {
                await updateShift(shift.id, data);
            } else {
                await createShift(data);
            }
        }
    );
}
