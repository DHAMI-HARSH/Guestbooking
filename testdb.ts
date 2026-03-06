import sql from "mssql";

const config = {
  server: "172.16.3.174",
  user: "sa",
  password: "sst@12345",
  database: "guesthouse",
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function test() {
  try {
    await sql.connect(config);
    console.log("✅ DB Connected");
  } catch (err) {
    console.error("❌ DB Error:", err);
  }
}

test();