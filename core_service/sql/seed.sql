INSERT INTO employees (name, phone, email, skills)
VALUES
    ('Иван Иванов', '+7 900 111-11-11', 'ivan@example.com', 'Склад, оборудование'),
    ('Анна Смирнова', '+7 900 222-22-22', 'anna@example.com', 'Документация, смены'),
    ('Пётр Петров', '+7 900 333-33-33', 'petr@example.com', 'Техника, ремонт');

INSERT INTO equipment (name, serial_number, location, status)
VALUES
    ('Ноутбук Lenovo', 'LEN-001', 'Офис 1', 'Исправно'),
    ('Принтер HP', 'HP-002', 'Офис 2', 'Исправно'),
    ('Сканер Canon', 'CAN-003', 'Склад', 'На ремонте');

-- login: admin
-- password: admin123
INSERT INTO users (login, password_hash, role, employee_id)
VALUES
    (
        'admin',
        'admin_salt$dea81d469e5c7771fe8a08741138f9f04807d5beb7b795233986c77b53828dc7',
        'admin',
        NULL
    );

-- login: user
-- password: user123
INSERT INTO users (login, password_hash, role, employee_id)
VALUES
    (
        'user',
        'user_salt$7a37a853c87c0c62dd8d5e1fb6ab59a121c3f16a560e7f5b74422303b9fdb0c2',
        'user',
        1
    );

INSERT INTO shifts (employee_id, shift_date, time, status, equipment_id)
VALUES
    (1, CURRENT_DATE, '09:00-18:00', 'Запланирована', 1),
    (2, CURRENT_DATE, '10:00-19:00', 'Запланирована', 2),
    (3, CURRENT_DATE + INTERVAL '1 day', '08:00-17:00', 'Запланирована', 3);