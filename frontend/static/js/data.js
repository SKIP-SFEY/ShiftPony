
const DEFAULT_API_PORT = '8000';

function getApiBase() {
    if (window.API_BASE) {
        return window.API_BASE.replace(/\/$/, '');
    }

    if (window.location.protocol === 'file:') {
        return `http://127.0.0.1:${DEFAULT_API_PORT}`;
    }

    if (window.location.port === DEFAULT_API_PORT || window.location.port === '') {
        return '';
    }

    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
}

const API_BASE = getApiBase();
const appContainer = document.getElementById('appContainer');

let currentSession = loadSession();



function setBrowserUrl(path) {
    const nextUrl = new URL(path, window.location.origin);

    if (window.location.href !== nextUrl.href) {
        window.history.pushState({}, '', nextUrl.href);
    }
}

function getUserBasePath(session = currentSession) {
    const login = session && session.login ? encodeURIComponent(session.login) : '';
    return login ? `/user/${login}` : '/';
}

function setUrlForSession(session = currentSession) {
    if (!session) {
        setBrowserUrl('/');
        return;
    }

    if (session.role === 'admin') {
        setBrowserUrl('/admin');
        return;
    }

    if (session.role === 'user') {
        setBrowserUrl(getUserBasePath(session));
    }
}

function setLoginUrl() {
    setBrowserUrl('/');
}

function loadSession() {
    try {
        const rawSession = localStorage.getItem('current_session');
        return rawSession ? JSON.parse(rawSession) : null;
    } catch (error) {
        console.warn('Не удалось прочитать current_session:', error);
        return null;
    }
}

function saveSession(session) {
    currentSession = session;
    localStorage.setItem('current_session', JSON.stringify(session));

    if (session && session.access_token) {
        localStorage.setItem('access_token', session.access_token);
    }
}

function clearSession() {
    currentSession = null;
    localStorage.removeItem('current_session');
    localStorage.removeItem('access_token');
}

function getToken() {
    return localStorage.getItem('access_token');
}


function getAuthHeaders(extraHeaders = {}) {
    const token = getToken();

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders
    };
}

function buildQuery(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.append(key, value);
        }
    });

    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
}

async function apiRequest(path, options = {}) {
    let response;

    try {
        response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: getAuthHeaders(options.headers || {})
        });
    } catch (error) {
        console.error('Backend недоступен:', error);
        throw new Error(
            `Не удалось подключиться к backend по адресу ${API_BASE || window.location.origin}. ` +
            'Проверь, что core_service запущен на порту 8000 и открыт доступ к этому порту.'
        );
    }

    let data = null;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        if (response.status === 401) {
            clearSession();
        }

        const message = data && data.detail ? data.detail : 'Ошибка запроса к серверу';
        throw new Error(message);
    }

    if (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE html')) {
        throw new Error('Backend вернул HTML-страницу вместо JSON. Проверь API-маршрут запроса.');
    }

    return data;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showError(error, fallbackMessage = 'Произошла ошибка') {
    console.error(error);
    alert(error && error.message ? error.message : fallbackMessage);
}

function showEmptyRow(colspan, text) {
    return `<tr><td colspan="${colspan}" class="empty-msg">${escapeHtml(text)}</td></tr>`;
}

function normalizeEquipment(equipment) {
    return {
        ...equipment,
        serial_number: equipment.serial_number ?? equipment.serialNumber ?? '—'
    };
}

function normalizeShift(shift) {
    return {
        ...shift,
        employee_id: shift.employee_id ?? shift.employeeId,
        equipment_id: shift.equipment_id ?? shift.equipmentId,
        employee_name: shift.employee_name ?? shift.employeeName,
        equipment_name: shift.equipment_name ?? shift.equipmentName
    };
}

async function loginUser(login, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password })
    });

    const session = {
        access_token: data.access_token,
        token_type: data.token_type,
        role: data.role,
        employeeId: data.employeeId,
        name: data.name,
        login
    };

    saveSession(session);
    return session;
}

function logout() {
    clearSession();
}


function getSessionLogin() {
    return currentSession && currentSession.login ? currentSession.login : '';
}

async function getCurrentProfile() {
    const login = getSessionLogin();

    if (!login) {
        throw new Error('Не найден логин текущего пользователя');
    }

    return await apiRequest(`/api/profile/${encodeURIComponent(login)}`);
}

async function refreshCurrentToken() {
    const login = getSessionLogin();

    if (!login) {
        throw new Error('Не найден логин текущего пользователя');
    }

    const data = await apiRequest(`/api/profile/${encodeURIComponent(login)}/refresh-token`, {
        method: 'POST'
    });

    saveSession({
        ...currentSession,
        access_token: data.access_token,
        token_type: data.token_type,
        role: data.role,
        employeeId: data.employeeId,
        name: data.name,
        login
    });

    return data;
}


async function fetchEmployees(params = {}) {
    return await apiRequest(`/employees/${buildQuery(params)}`);
}

async function getEmployeeById(id) {
    try {
        return await apiRequest(`/employees/${id}`);
    } catch (error) {
        if (error.message === 'Employee not found') return null;
        throw error;
    }
}

async function createEmployee(employeeData) {
    return await apiRequest('/employees/', {
        method: 'POST',
        body: JSON.stringify(employeeData)
    });
}

async function updateEmployee(id, employeeData) {
    return await apiRequest(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(employeeData)
    });
}

async function deleteEmployee(id) {
    return await apiRequest(`/employees/${id}`, {
        method: 'DELETE'
    });
}


async function fetchEquipment(params = {}) {
    const rows = await apiRequest(`/equipment/${buildQuery(params)}`);
    return rows.map(normalizeEquipment);
}

async function getEquipmentById(id) {
    try {
        const equipment = await apiRequest(`/equipment/${id}`);
        return normalizeEquipment(equipment);
    } catch (error) {
        if (error.message === 'Equipment not found') return null;
        throw error;
    }
}

async function createEquipment(equipmentData) {
    const created = await apiRequest('/equipment/', {
        method: 'POST',
        body: JSON.stringify(equipmentData)
    });

    return normalizeEquipment(created);
}

async function updateEquipment(id, equipmentData) {
    const updated = await apiRequest(`/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(equipmentData)
    });

    return normalizeEquipment(updated);
}

async function deleteEquipment(id) {
    return await apiRequest(`/equipment/${id}`, {
        method: 'DELETE'
    });
}


async function fetchShifts(params = {}) {
    const rows = await apiRequest(`/shifts/${buildQuery(params)}`);
    return rows.map(normalizeShift);
}

async function getShiftById(id) {
    const shift = await apiRequest(`/shifts/${id}`);
    return normalizeShift(shift);
}

async function createShift(shiftData) {
    const created = await apiRequest('/shifts/', {
        method: 'POST',
        body: JSON.stringify(shiftData)
    });

    return normalizeShift(created);
}

async function updateShift(id, shiftData) {
    const updated = await apiRequest(`/shifts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(shiftData)
    });

    return normalizeShift(updated);
}

async function deleteShift(id) {
    return await apiRequest(`/shifts/${id}`, {
        method: 'DELETE'
    });
}

async function getShiftsForEmployee(employeeId) {
    return await fetchShifts({ employee_id: employeeId, sort_by: 'date', order: 'asc' });
}

async function getUpcomingShifts(employeeId) {
    const today = new Date().toISOString().slice(0, 10);
    return await fetchShifts({
        employee_id: employeeId,
        date_from: today,
        sort_by: 'date',
        order: 'asc'
    });
}

async function getEmployeeEquipmentCount(employeeId) {
    const shifts = await getShiftsForEmployee(employeeId);
    const equipmentIds = new Set(
        shifts
            .map(shift => shift.equipment_id)
            .filter(Boolean)
    );

    return equipmentIds.size;
}

async function getAdminStats() {
    return await apiRequest('/admin/stats');
}

async function getTodayShiftsList() {
    const rows = await apiRequest('/admin/shifts/today');
    return rows.map(normalizeShift);
}

async function getShiftsByStatus() {
    return await apiRequest('/admin/stats/shifts-by-status');
}

async function getEquipmentByStatus() {
    return await apiRequest('/admin/stats/equipment-by-status');
}
