const db = require('./src/config/db');

async function testConnection() {
    try {
        const res = await db.query('SELECT NOW()');
        console.log('✅ Berhasil terhubung ke Supabase Database!');
        console.log('Waktu Server Database:', res.rows[0].now);
        process.exit(0);
    } catch (err) {
        console.error('❌ Gagal terhubung ke Supabase Database:', err.message);
        process.exit(1);
    }
}

testConnection();
