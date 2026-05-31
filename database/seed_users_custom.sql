-- Custom user-only seed for PostgreSQL
-- Admin password: 987654321
-- Employee/approver/estate password: 12345678

INSERT INTO users (
    ecode,
    name,
    unit,
    department,
    role,
    password_hash,
    is_active
)
VALUES
(
    'SMIT001',
    'Smit',
    'Admin Office',
    'Administration',
    'ADMIN',
    '$2b$10$x/IMs/dEUIYQ3YtFrxoSCuyRvLiXd.yhvNC11HYdEJyKDZ2RuI5N.',
    TRUE
),
(
    'HARSH001',
    'Harsh',
    'Admin Office',
    'Administration',
    'ADMIN',
    '$2b$10$x/IMs/dEUIYQ3YtFrxoSCuyRvLiXd.yhvNC11HYdEJyKDZ2RuI5N.',
    TRUE
),
(
    'EMP001',
    'Employee User',
    'Academic Affairs',
    'Computer Science',
    'EMPLOYEE',
    '$2b$10$V5jUMsxol5W07JmmhcdcB.mVCTUSe16eV27RXpF52U4NYn.HYH.Bq',
    TRUE
),
(
    'APP001',
    'Approver User',
    'Dean Office',
    'Administration',
    'APPROVER',
    '$2b$10$V5jUMsxol5W07JmmhcdcB.mVCTUSe16eV27RXpF52U4NYn.HYH.Bq',
    TRUE
),
(
    'EST001',
    'Estate User',
    'Estate Cell',
    'Estate Management',
    'ESTATE_PRIMARY',
    '$2b$10$V5jUMsxol5W07JmmhcdcB.mVCTUSe16eV27RXpF52U4NYn.HYH.Bq',
    TRUE
);
