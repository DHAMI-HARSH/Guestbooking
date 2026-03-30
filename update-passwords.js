const bcrypt = require('bcryptjs');

async function generateHashes() {
  const password = 'password'; // Default password for all users
  
  try {
    const hash = await bcrypt.hash(password, 10);
    console.log('Bcrypt hash for "password":', hash);
    console.log('\nRun this SQL to update your database:\n');
    console.log(`USE guesthouse;
UPDATE Users SET password_hash = '${hash}' WHERE ecode IN ('EMP001', 'APP001', 'EST001', 'EST002');`);
  } catch (error) {
    console.error('Error:', error);
  }
}

generateHashes();
