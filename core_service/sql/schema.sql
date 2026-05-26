DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    email VARCHAR(150) NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '—'
);

CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    serial_number VARCHAR(100) NOT NULL DEFAULT '—',
    location VARCHAR(150) NOT NULL DEFAULT '—',
    status VARCHAR(50) NOT NULL DEFAULT 'Исправно'
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,

    CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))
);

CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    time VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Запланирована',
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE SET NULL
);

CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_employees_email ON employees(email);

CREATE INDEX idx_equipment_name ON equipment(name);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_serial_number ON equipment(serial_number);

CREATE INDEX idx_users_login ON users(login);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_shifts_employee_id ON shifts(employee_id);
CREATE INDEX idx_shifts_equipment_id ON shifts(equipment_id);
CREATE INDEX idx_shifts_date ON shifts(shift_date);
CREATE INDEX idx_shifts_status ON shifts(status);