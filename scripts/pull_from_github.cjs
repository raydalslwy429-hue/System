const { execSync } = require('child_process');
const dns = require('dns').promises;
const path = require('path');

const repoDir = path.resolve(__dirname, '..');

async function isOnline() {
  try {
    await Promise.race([
      dns.lookup('github.com'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

async function pullFromGithub() {
  console.log("🌐 جارٍ التحقق من اتصال الإنترنت بـ GitHub...");
  const online = await isOnline();
  if (!online) {
    console.error("❌ تعذر الاتصال: جهاز الكمبيوتر غير متصل بالإنترنت حالياً (Offline).");
    console.error("💡 يرجى التأكد من تشغيل شبكة الإنترنت / الواي فاي ثم المحاولة مجدداً.");
    process.exit(1);
  }

  try {
    console.log("📥 جاري سحب وتحديث أحدث الأكواد والتصاميم من GitHub (git pull origin main)...");
    execSync('git pull origin main', { cwd: repoDir, stdio: 'inherit' });
    console.log("🎉 تم بنجاح سحب وتحديث كود البرمجة والشاشات من GitHub!");
    return { success: true, message: "تم بنجاح سحب وتحديث كود البرمجة والشاشات من مستودع GitHub!" };
  } catch (err) {
    console.error("❌ حدث خطأ أثناء السحب من GitHub:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  pullFromGithub().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { pullFromGithub };
