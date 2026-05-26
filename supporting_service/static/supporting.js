let chartInstances = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function prettyJson(data) {
    return JSON.stringify(data, null, 2);
}

function buildQuery(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.append(key, value);
        }
    });

    const result = query.toString();
    return result ? `?${result}` : '';
}

async function requestJson(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
        const detail = typeof data === 'object' ? data.detail || prettyJson(data) : data;
        throw new Error(detail || `Ошибка запроса: ${response.status}`);
    }

    return data;
}

function destroyCharts() {
    chartInstances.forEach(chart => chart.destroy());
    chartInstances = [];
}

function renderStats(overview, notifications) {
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-number">${overview.employeesCount ?? 0}</div><div class="stat-label">Сотрудники</div></div>
        <div class="stat-card"><div class="stat-number">${overview.equipmentCount ?? 0}</div><div class="stat-label">Оборудование</div></div>
        <div class="stat-card"><div class="stat-number">${overview.shiftsCount ?? 0}</div><div class="stat-label">Смены</div></div>
        <div class="stat-card"><div class="stat-number">${notifications.count ?? 0}</div><div class="stat-label">Уведомления</div></div>
    `;
}

function renderWorkload(items = []) {
    const body = document.getElementById('workloadBody');

    if (!items.length) {
        body.innerHTML = '<tr><td colspan="2">Данных по нагрузке нет</td></tr>';
        return;
    }

    body.innerHTML = items.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.shiftsCount)}</td>
        </tr>
    `).join('');
}

function drawBarChart(canvasId, title, items = []) {
    const canvas = document.getElementById(canvasId);
    const labels = items.map(item => item.status || 'Без статуса');
    const values = items.map(item => Number(item.count || 0));

    if (!window.Chart) {
        return;
    }

    const chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: title, data: values }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });

    chartInstances.push(chart);
}

function renderCharts(overview) {
    destroyCharts();
    drawBarChart('shiftsChart', 'Смены', overview.shiftsByStatus || []);
    drawBarChart('equipmentChart', 'Оборудование', overview.equipmentByStatus || []);
}

async function refreshData() {
    try {
        const [overview, notices] = await Promise.all([
            requestJson('/api/analytics/overview'),
            requestJson('/api/notifications')
        ]);

        renderStats(overview, notices);
        renderWorkload(overview.employeeWorkload || []);
        renderCharts(overview);
        renderNotifications(notices.items || []);
    } catch (error) {
        console.error(error);
        document.getElementById('workloadBody').innerHTML = `<tr><td colspan="2">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function loadReports() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const status = document.getElementById('statusFilter').value;

    try {
        const [summary, shifts] = await Promise.all([
            requestJson('/api/reports/summary' + buildQuery({ date_from: dateFrom, date_to: dateTo })),
            requestJson('/api/reports/shifts' + buildQuery({ date_from: dateFrom, date_to: dateTo, status }))
        ]);

        document.getElementById('summaryBox').textContent = prettyJson(summary);
        renderShiftsReport(shifts.items || []);
    } catch (error) {
        document.getElementById('summaryBox').textContent = error.message;
    }
}

function renderShiftsReport(items = []) {
    const body = document.getElementById('shiftsReportBody');

    if (!items.length) {
        body.innerHTML = '<tr><td colspan="5">Нет смен по выбранным фильтрам</td></tr>';
        return;
    }

    body.innerHTML = items.map(item => `
        <tr>
            <td>${escapeHtml(item.date)}</td>
            <td>${escapeHtml(item.time)}</td>
            <td>${escapeHtml(item.employeeName)}</td>
            <td>${escapeHtml(item.equipmentName || '—')}</td>
            <td>${escapeHtml(item.status)}</td>
        </tr>
    `).join('');
}

async function loadNotifications() {
    const userId = document.getElementById('noticeUserFilter')?.value.trim();

    try {
        const notices = await requestJson('/api/notifications' + buildQuery({ user_id: userId }));
        renderNotifications(notices.items || []);
    } catch (error) {
        document.getElementById('notificationsList').textContent = error.message;
    }
}

function renderNotifications(items = []) {
    const list = document.getElementById('notificationsList');

    if (!items.length) {
        list.textContent = 'Уведомлений нет';
        return;
    }

    list.innerHTML = items.map(item => `
        <div class="notice-item">
            <strong>${escapeHtml(item.title)}</strong>
            <div>${escapeHtml(item.message)}</div>
            <div class="notice-meta">
                Пользователь: ${escapeHtml(item.userLogin || item.userId || '—')} ·
                Тип: ${escapeHtml(item.type)} ·
                ${item.isRead ? 'прочитано' : 'не прочитано'} ·
                ${escapeHtml(item.createdAt)}
            </div>
            ${item.isRead ? '' : `<button class="notice-read-btn" data-id="${item.id}">Отметить прочитанным</button>`}
        </div>
    `).join('');

    document.querySelectorAll('.notice-read-btn').forEach(button => {
        button.addEventListener('click', async () => {
            await requestJson(`/api/notifications/${button.dataset.id}/read`, { method: 'PATCH' });
            await loadNotifications();
            await refreshData();
        });
    });
}

async function createNotification() {
    const title = document.getElementById('noticeTitle').value.trim();
    const message = document.getElementById('noticeMessage').value.trim();
    const type = document.getElementById('noticeType').value;
    const userId = document.getElementById('noticeUserId').value.trim();

    if (!title || !message) {
        document.getElementById('notificationsList').textContent = 'Введите заголовок и текст уведомления';
        return;
    }

    try {
        const body = { title, message, type };

        if (userId) {
            body.user_id = Number(userId);
        }

        await requestJson('/api/notifications', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        document.getElementById('noticeTitle').value = '';
        document.getElementById('noticeMessage').value = '';
        await loadNotifications();
        await refreshData();
    } catch (error) {
        document.getElementById('notificationsList').textContent = error.message;
    }
}

async function loadGatewayRoutes() {
    try {
        const data = await requestJson('/api/gateway/routes');
        const routes = data.routes || [];
        document.getElementById('routesBody').innerHTML = routes.map(route => `
            <tr>
                <td>${escapeHtml(route.method)}</td>
                <td>${escapeHtml(route.path)}</td>
                <td>${escapeHtml(route.group)}</td>
            </tr>
        `).join('') || '<tr><td colspan="3">Маршрутов нет</td></tr>';
    } catch (error) {
        document.getElementById('routesBody').innerHTML = `<tr><td colspan="3">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function loadAbout() {
    try {
        const data = await requestJson('/api/about');
        document.getElementById('aboutBox').textContent = prettyJson(data);
    } catch (error) {
        document.getElementById('aboutBox').textContent = error.message;
    }
}

async function makeHash() {
    const value = document.getElementById('hashInput').value.trim();

    if (!value) {
        document.getElementById('hashResult').textContent = 'Введите строку';
        return;
    }

    try {
        const data = await requestJson(`/api/hash/${encodeURIComponent(value)}`);
        document.getElementById('hashResult').textContent = prettyJson(data);
    } catch (error) {
        document.getElementById('hashResult').textContent = error.message;
    }
}

function setupTabs() {
    document.querySelectorAll('.nav-tab').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(item => item.classList.remove('active'));
            button.classList.add('active');

            const tab = button.dataset.tab;
            document.querySelectorAll('.tab-section').forEach(section => section.classList.add('hidden'));
            document.getElementById(`tab${tab[0].toUpperCase()}${tab.slice(1)}`).classList.remove('hidden');
        });
    });
}

function setupEvents() {
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('reportsBtn').addEventListener('click', loadReports);
    document.getElementById('loadNoticesBtn').addEventListener('click', loadNotifications);
    document.getElementById('createNoticeBtn').addEventListener('click', createNotification);
    document.getElementById('hashBtn').addEventListener('click', makeHash);
}

document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupEvents();
    await Promise.all([loadGatewayRoutes(), loadAbout(), refreshData()]);
});
